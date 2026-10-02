# VoxQuest — Backend (Laravel 12 + PostgreSQL)

API + cloud sync + gamification server for the VoxQuest PWA. The frontend keeps
working offline against IndexedDB; this backend **syncs and backs up** that
progress, adds accounts, and powers leaderboards.

- **Laravel 12**, PHP 8.3
- **PostgreSQL** (required — MySQL is not supported/tested)
- **Sanctum** token auth (stateless API for a PWA / future mobile app)
- **Redis** optional (leaderboard cache); falls back to the DB cache store
- **Pest** tests — 68 tests / 444 assertions, run against a real PostgreSQL DB

See [`API.md`](API.md) for every endpoint and [`DEPLOY.md`](DEPLOY.md) for
hosting (Railway/Render or Oracle Cloud Always Free).

---

## Local setup

```bash
# 1. deps
composer install

# 2. env
cp .env.example .env
php artisan key:generate
#   edit .env DB_* to match your Postgres (defaults: db "voxquest", user/pass "voxquest")

# 3. databases + role  (psql as a superuser)
CREATE ROLE voxquest LOGIN PASSWORD 'voxquest' CREATEDB;
CREATE DATABASE voxquest      OWNER voxquest;
CREATE DATABASE voxquest_test OWNER voxquest;   -- used by the test suite
\c voxquest      ;  ALTER SCHEMA public OWNER TO voxquest;
\c voxquest_test ;  ALTER SCHEMA public OWNER TO voxquest;

# 4. migrate + seed the 12-achievement catalog
php artisan migrate --seed

# 5. serve
php artisan serve            # http://localhost:8000
```

## Tests

```bash
php artisan test             # everything
php artisan test --testsuite=Feature
```
`phpunit.xml` points the suite at the **`voxquest_test`** database on PostgreSQL
(not SQLite) so JSON columns, upserts and unique constraints behave exactly as
in production. Coverage includes: XP formula parity with the frontend, the
per-exercise XP cap (anti-cheat), achievement unlock for every rule type,
streak logic incl. the grace day, the unit unlock cascade, sync batch + event
idempotency, "best wins" merges, multi-device convergence, and rate limiting on
`auth` and `sync`.

## Architecture

```
app/
  Domain/                     ← framework-free business logic, unit-testable
    Xp/XpCalculator.php          mirror of src/game/xp.ts (authoritative)
    Streaks/StreakService.php    daily streak + configurable grace day
    Achievements/                rule-opcode evaluator (mirror of achievements.ts)
    Progress/
      RecordExerciseResult.php   THE core transaction (see below)
      UnitProgressRecalculator   unit rollup + unlock cascade to a fixed point
      ConsolidatedStateBuilder   the `state` object returned to the client
      UserBootstrapper           seeds streak + unit_progress for a new account
    Sync/SyncBatchProcessor.php   offline batch apply + conflict resolution
    Leaderboards/LeaderboardService.php   weekly XP + active-streak boards (cached)
    Admin/AdminMetricsService.php
  Http/Controllers/Api/V1/     ← thin controllers, one per resource
  Http/Requests/               ← FormRequest validation
config/voxquest.php            ← SERVER SOURCE OF TRUTH: exercise catalog,
                                 XP curve, star thresholds, achievement rules,
                                 unit graph. Mirrors the frontend.
```

### The core write path — `RecordExerciseResult`

Every "I finished an exercise" (live via `POST /exercises/{id}/result`, or
replayed inside `POST /sync`) runs one atomic `DB::transaction` with the user
row locked `FOR UPDATE`:

1. resolve the exercise from `config/voxquest.php` (reject unknown ids → 422)
2. idempotency guard on `client_generated_id` — replay is a no-op
3. derive `stars` + **canonical XP** server-side (client `stars`/`amount` ignored;
   metrics sanitised & capped)
4. append an **`xp_events`** row (append-only ledger, never mutated)
5. upsert **`exercise_results`** — *best wins* (`max` stars/score, `+1` attempts,
   per-key `max` metric merge)
6. recompute **`unit_progress`** + run the unlock cascade
7. recompute **`users.xp_total`** = `SUM(xp_events.amount)`
8. touch the **streak** for the day the event occurred
9. evaluate **achievements** (monotonic — never revoked)

### Anti-cheat

- XP for exercises is never taken from the client — it is recomputed from
  `base_xp` (catalog) × stars × score × first-clear, then clamped to
  `maxXpForExercise()` (3-star/perfect/first-clear ceiling) and a global
  `hard_event_cap`.
- Explicit `xp` events in a sync batch are validated against that same cap; over
  the cap → the event is rejected (batch still succeeds for the rest).
- Metric values are coerced to finite, non-negative, and capped (3600) so
  metric-based achievements can't be unlocked with absurd numbers.
- `auth` endpoints: 5/min per IP **and** per email. `sync`: 20/min per user.

## Cloud sync from the frontend

`../src/game/cloudSync.ts` (in the PWA repo) is the concrete implementation of
the frontend's `registerCloudSync()` extension point:

- turns local state changes into append-only events, queued in IndexedDB
- flushes them to `POST /api/v1/sync` as one batch with a stable
  `idempotency_key` (kept across retries) — deterministic `client_generated_id`
  per event makes partial retries safe
- exponential backoff, retries on `online`
- merges the server's authoritative `state` back in (monotonic — only moves
  progress forward)

This is **already wired** in the PWA (`src/main.tsx` calls `initCloudSync`) and
surfaced in the UI:

- `src/game/authStore.ts` — session state (`login / register / logout / syncNow`).
- `src/game/api.ts` — `auth.*` helpers + `updateProfile` + the retrying `apiFetch`.
- `src/screens/Account.tsx` — login / register screen (route `/account`).
- Ajustes → "Cuenta y sincronizacion" — sign in/out, sync status, "Sincronizar ahora".
- Header shows a cloud indicator (`☁︎✓` / pending count / offline) when signed in.

Sign-in behaviour: existing offline progress is uploaded (null baseline → the
whole local state is diffed into events), the client-detected profile (name,
voice range, `onboarded`) is `PATCH`ed to `/profile`, then the server's
consolidated state is merged back (monotonic — only moves progress forward).

Config: the PWA reads `VITE_API_URL` (`.env`), default
`http://localhost:8000/api/v1`. Auth is **pure Bearer token** — `statefulApi()`
and `SANCTUM_STATEFUL_DOMAINS` are intentionally off (no cookies / CSRF).

## Notes / deviations from the original spec

- Added **`exercise_results`** (granular, keyed by `exerciseId` like the
  frontend) alongside **`unit_progress`** (the requested per-unit rollup) —
  "best wins" conflict resolution needs the per-exercise grain; `unit_progress`
  is derived from it in the same transaction.
- Added **`sync_batches`** for whole-batch idempotency + audit.
- Email verification is implemented but **non-blocking** unless
  `VOXQUEST_REQUIRE_EMAIL_VERIFICATION=true`.
- Social login is left as an extension point only (not implemented), per spec.
