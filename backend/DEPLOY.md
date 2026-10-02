# Deploying the VoxQuest backend

Two viable low/no‑cost options. **Railway/Render** is the fastest for an MVP.
**Oracle Cloud Always Free** costs nothing indefinitely but is more hands‑on.

The frontend PWA stays wherever it already lives (Netlify/Vercel/Cloudflare
Pages / a static host). Only two things connect them:

1. Set the PWA build env `VITE_API_URL=https://<your-api-host>/api/v1`.
2. Set the API env `VOXQUEST_FRONTEND_ORIGINS` to the PWA's origin(s) so CORS
   allows it.

---

## Option A — Railway (or Render) — ~10 min

Good for: getting a real URL today. Free tier is enough for early users; both
bill by usage after a small monthly credit.

### Railway

1. Push this `backend/` folder to a GitHub repo (its own repo, or a subdir —
   Railway supports a "Root Directory" setting).
2. **railway.app → New Project → Deploy from GitHub repo.** Set *Root Directory*
   to `backend` if it's a subdir.
3. Add a **PostgreSQL** plugin (New → Database → PostgreSQL). Railway injects
   `DATABASE_URL`.
4. Add a **Redis** plugin (optional but recommended for leaderboards).
5. Project → **Variables**:
   ```
   APP_NAME=VoxQuest
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=            # generate locally: php artisan key:generate --show
   APP_URL=https://<railway-generated-domain>
   LOG_CHANNEL=stderr

   # Railway gives DATABASE_URL; Laravel reads it directly. Or set the pieces:
   DB_CONNECTION=pgsql
   # DATABASE_URL is picked up automatically when DB_CONNECTION=pgsql

   CACHE_STORE=redis
   REDIS_CLIENT=predis
   REDIS_URL=${{Redis.REDIS_URL}}
   QUEUE_CONNECTION=database
   SESSION_DRIVER=database

   VOXQUEST_FRONTEND_ORIGINS=https://voxquest.yourdomain.com
   VOXQUEST_REQUIRE_EMAIL_VERIFICATION=false
   SANCTUM_STATEFUL_DOMAINS=voxquest.yourdomain.com
   ```
6. **Build command:** `composer install --no-dev --optimize-autoloader`
   **Start command:**
   ```
   php artisan migrate --force && php artisan db:seed --class=AchievementSeeder --force && php artisan config:cache && php -S 0.0.0.0:$PORT -t public
   ```
   (For real traffic swap the last part for `php artisan octane:start` or an
   FPM/nginx image — see the Dockerfile note below.)
7. Deploy. Hit `https://<domain>/up` (Laravel health check) then
   `https://<domain>/api/v1/auth/register`.

### Render

Same idea: **New → Web Service** from the repo, Runtime *PHP* (or Docker),
add a **PostgreSQL** instance and a **Key Value (Redis)** instance, paste the
same env vars (Render exposes `DATABASE_URL` / `REDIS_URL`), set the build &
start commands above. Render's free Postgres expires after 90 days — fine for a
prototype, migrate to the $7 plan or Option B for anything real.

### Minimal production Dockerfile (either host)

```dockerfile
FROM serversideup/php:8.3-fpm-nginx
WORKDIR /var/www/html
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction
ENV PHP_OPCACHE_ENABLE=1
# Entrypoint runs migrations then serves via nginx+php-fpm on $PORT
CMD php artisan migrate --force \
 && php artisan db:seed --class=AchievementSeeder --force \
 && php artisan config:cache && php artisan route:cache \
 && /usr/local/bin/entrypoint
```

---

## Option B — Oracle Cloud Always Free — $0 forever

Good for: no ongoing cost. You get an ARM Ampere VM (up to 4 OCPU / 24 GB RAM
free) that comfortably runs PHP‑FPM + PostgreSQL + Redis on one box.

1. **Create the VM.** OCI Console → Compute → Instances → Create.
   - Shape: `VM.Standard.A1.Flex`, 2 OCPU / 12 GB (stays in the Always Free box).
   - Image: Ubuntu 22.04.
   - Save the SSH key. Note the public IP.
2. **Open ports.** VCN → the instance's subnet → Security List → add Ingress
   rules for TCP `80` and `443` from `0.0.0.0/0`. (Also run
   `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` etc. or
   `sudo netfilter-persistent` — Oracle images ship a restrictive iptables.)
3. **Provision** (`ssh ubuntu@<ip>`):
   ```bash
   sudo apt update && sudo apt install -y nginx postgresql redis-server \
     php8.3-fpm php8.3-pgsql php8.3-redis php8.3-mbstring php8.3-xml php8.3-curl \
     php8.3-bcmath php8.3-intl unzip git
   curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer

   sudo -u postgres psql -c "CREATE ROLE voxquest LOGIN PASSWORD 'CHANGE_ME';"
   sudo -u postgres psql -c "CREATE DATABASE voxquest OWNER voxquest;"
   ```
4. **Deploy the app:**
   ```bash
   sudo mkdir -p /var/www/voxquest && sudo chown $USER /var/www/voxquest
   git clone <your-repo> /var/www/voxquest && cd /var/www/voxquest/backend
   composer install --no-dev --optimize-autoloader
   cp .env.example .env
   # edit .env: APP_ENV=production, APP_DEBUG=false, DB_PASSWORD=CHANGE_ME,
   #            CACHE_STORE=redis, VOXQUEST_FRONTEND_ORIGINS=https://voxquest.yourdomain.com
   php artisan key:generate
   php artisan migrate --force
   php artisan db:seed --class=AchievementSeeder --force
   php artisan config:cache && php artisan route:cache
   sudo chown -R www-data:www-data storage bootstrap/cache
   ```
5. **nginx** `/etc/nginx/sites-available/voxquest`:
   ```nginx
   server {
     listen 80;
     server_name api.voxquest.yourdomain.com;
     root /var/www/voxquest/backend/public;
     index index.php;
     location / { try_files $uri $uri/ /index.php?$query_string; }
     location ~ \.php$ {
       include snippets/fastcgi-php.conf;
       fastcgi_pass unix:/run/php/php8.3-fpm.sock;
     }
     location ~ /\.(?!well-known).* { deny all; }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/voxquest /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.voxquest.yourdomain.com   # free TLS
   ```
6. **Queue worker + scheduler** (systemd):
   ```ini
   # /etc/systemd/system/voxquest-worker.service
   [Service]
   User=www-data
   WorkingDirectory=/var/www/voxquest/backend
   ExecStart=/usr/bin/php artisan queue:work --sleep=1 --tries=3 --max-time=3600
   Restart=always
   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable --now voxquest-worker
   # scheduler (currently only used if you add scheduled tasks):
   ( crontab -l 2>/dev/null; echo "* * * * * cd /var/www/voxquest/backend && php artisan schedule:run >> /dev/null 2>&1" ) | crontab -
   ```
7. **Deploys after the first:** `git pull && composer install --no-dev -o &&
   php artisan migrate --force && php artisan config:cache && php artisan route:cache &&
   sudo systemctl restart voxquest-worker php8.3-fpm`.

---

## Post‑deploy checklist

- [ ] `GET https://<host>/up` returns 200.
- [ ] `POST /api/v1/auth/register` returns a token.
- [ ] From the deployed PWA origin, a browser request to the API succeeds (no
      CORS error in the console) — confirms `VOXQUEST_FRONTEND_ORIGINS`.
- [ ] `php artisan voxquest:metrics` runs on the server.
- [ ] `APP_DEBUG=false` and `APP_KEY` is set.
- [ ] DB backups: Railway/Render snapshot automatically; on Oracle add
      `pg_dump` to cron and copy to Object Storage (also Always Free).
- [ ] Grant yourself admin: `php artisan tinker` →
      `User::where('email','you@x.com')->update(['is_admin'=>true]);`
