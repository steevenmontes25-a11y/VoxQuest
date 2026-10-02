<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    /**
     * Named limiters used by the API route groups.
     *
     *  - auth : login / register / password endpoints. Tight, keyed by IP+email
     *           to blunt credential stuffing without locking a shared NAT.
     *  - sync : the batch sync endpoint. Generous per authenticated user, since a
     *           returning-from-offline client legitimately flushes a large queue.
     *  - api  : catch-all for the rest of the authenticated surface.
     */
    protected function configureRateLimiters(): void
    {
        RateLimiter::for('auth', function (Request $request) {
            $email = (string) $request->input('email');

            return [
                Limit::perMinute(5)->by($request->ip() ?: 'unknown'),
                Limit::perMinute(5)->by('email:'.mb_strtolower($email)),
            ];
        });

        RateLimiter::for('sync', function (Request $request) {
            $key = $request->user()?->getAuthIdentifier() ?: $request->ip();

            return Limit::perMinute(20)->by('sync:'.$key);
        });

        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->getAuthIdentifier() ?: $request->ip();

            return Limit::perMinute(120)->by('api:'.$key);
        });
    }
}
