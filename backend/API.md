# VoxQuest API v1

Base URL (local): `http://localhost:8000/api/v1`
Auth: **Bearer token** (Laravel Sanctum personal access token). Send
`Authorization: Bearer <token>` and `Accept: application/json` on every
authenticated call.

All responses are JSON. Validation errors are `422` with
`{ "message": "...", "errors": { "field": ["..."] } }`. Auth failures are `401`.
Rate‑limit hits are `429` with a `Retry-After` header.

Rate limits: `auth` group = 5/min per IP **and** per email; `sync` = 20/min per
user; everything else = 120/min per user.

---

## Conventions

| Concept | Meaning |
| --- | --- |
| `client_generated_id` | A UUID the client mints once per local event. Guarantees an event is applied **at most once**, even across retries and multiple devices. |
| `idempotency_key` | A UUID per **sync batch**. Re‑POSTing the same key returns the stored result without re‑applying anything. |
| `occurred_at` / `recorded_at` | Client wall‑clock time the thing happened. Used for streak day attribution when replaying offline events. Server also stamps its own receipt time. |
| **XP is server‑computed** | The client never sends XP amounts for exercises. The server derives XP from `score` + the exercise catalog (`config/voxquest.php`) and caps it. |
| **State shape** | `GET /state` and `POST /sync` both return a `state` object the client merges field‑by‑field into its local IndexedDB copy. |

---

## Auth

### `POST /auth/register`  · public · `throttle:auth`
```json
{
  "name": "Steeven",
  "email": "steeven@example.com",
  "password": "secret123",
  "password_confirmation": "secret123",
  "device_name": "pwa-chrome"          // optional, labels the token
}
```
`201`:
```json
{
  "token": "12|xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "user": {
    "id": 1, "name": "Steeven", "email": "steeven@example.com",
    "email_verified": false, "avatar_url": null, "onboarded": false,
    "voice": { "type_key": null, "type_label": null, "range_low_midi": null, "range_high_midi": null },
    "xp_total": 0, "level": 1, "level_progress": 0,
    "registered_at": "2026-09-08T12:00:00+00:00"
  }
}
```
Side effects: a `streaks` row and one `unit_progress` row per catalog unit are
created (initial units unlocked). A verification email is queued (non‑blocking).

### `POST /auth/login`  · public · `throttle:auth`
```json
{ "email": "steeven@example.com", "password": "secret123", "device_name": "pwa-chrome" }
```
`200`: same body as register. Wrong credentials → `422` on `email`.

### `GET /auth/me`  · auth
`200`: `{ "data": { ...UserResource } }`

### `POST /auth/logout`  · auth
Revokes the calling token. `200 { "message": "Sesion cerrada." }`

### `POST /auth/logout-all`  · auth
Revokes every token for the user.

### Email verification (optional)
- `POST /email/verification-notification` · auth — resend the link.
- `GET  /email/verify/{id}/{hash}` · signed URL — marks the email verified.

Verification is **not enforced** unless `VOXQUEST_REQUIRE_EMAIL_VERIFICATION=true`,
in which case progress‑write endpoints answer `409 { "code": "email_unverified" }`.

---

## Profile

### `GET /profile` · auth
`200 { "data": { ...UserResource } }`

### `PATCH /profile` · auth
All fields optional. The vocal range / voice type are **client‑detected results**
stored verbatim — the server never recomputes them.
```json
{
  "name": "Steeven",
  "avatar_url": "https://.../me.png",
  "voice_type_key": "baritone",        // bass|baritone|tenor|contralto|mezzo|soprano
  "voice_type_label": "Baritono",
  "range_low_midi": 45,                // 16..108, must be <= range_high_midi
  "range_high_midi": 64,
  "mark_onboarded": true               // sets onboarded_at once; never moves it
}
```
`200 { "data": { ...UserResource } }`

### `DELETE /account` · auth
Hard‑deletes the user and every child row (xp_events, achievements, streak,
progress, tokens) via `ON DELETE CASCADE`. `200 { "message": "Cuenta eliminada." }`

---

## Progress & gamification

### `GET /state` · auth
The full server‑authoritative snapshot. Use it on app start / after login to
reconcile the local copy.
```json
{
  "state": {
    "server_time": "2026-09-08T12:00:00+00:00",
    "profile": { "name": "Steeven", "onboarded": true, "voice_type_key": "baritone",
                 "voice_type_label": "Baritono", "range_low_midi": 45, "range_high_midi": 64 },
    "xp_total": 412, "level": 3, "level_into": 8, "level_span": 413, "level_progress": 0.0194,
    "streak": { "current": 4, "longest": 9, "last_activity_date": "2026-09-08" },
    "unlocked_units": ["u-breath-1", "u-pitch-1", "u-pitch-2", "u-theory-1", "u-tech-1"],
    "results": {
      "ex-pitch-falling-1": { "exercise_id": "ex-pitch-falling-1", "unit_id": "u-pitch-1",
        "module": "pitch", "stars": 2, "best_score": 0.82, "attempts": 3,
        "metrics": { "perfectNotes": 4, "maxCombo": 6 }, "last_played_at": "2026-09-08T11:59:00+00:00" }
    },
    "units": {
      "u-pitch-1": { "unit_id": "u-pitch-1", "module": "pitch", "status": "completed",
        "stars_earned": 6, "stars_possible": 9, "exercises_cleared": 3, "best_score": 0.9,
        "unlocked": true, "completed_at": "2026-09-08T11:59:00+00:00" }
    },
    "achievements": [ { "id": "first-exercise", "unlocked_at": "2026-09-08T10:00:00+00:00" } ]
  }
}
```

### `POST /exercises/{exercise}/result` · auth
Record one completion from **live online play**. `{exercise}` is a catalog id
(e.g. `ex-pitch-falling-1`). Unknown id → `422`.
```json
{
  "score": 0.82,                       // required, 0..1
  "metrics": { "perfectNotes": 4, "maxCombo": 6 },   // optional, numeric values; capped at 3600 each
  "client_generated_id": "b1e...-uuid",              // optional; generated if omitted
  "occurred_at": "2026-09-08T11:59:00Z"              // optional
}
```
`201` when applied, `200` when it was a replay:
```json
{
  "outcome": {
    "applied": true, "xp_gained": 97, "stars": 2, "first_clear": true,
    "leveled_up": false, "level_before": 2, "level_after": 2,
    "new_achievements": ["first-note", "first-exercise"]
  },
  "state": { ...full state... }
}
```
`stars` and any `amount`/`xp` in the body are ignored — the server derives them.

### `POST /vocal-range` · auth
Append a vocal‑range snapshot (for the evolution chart).
```json
{
  "low_midi": 45, "high_midi": 64,           // required, 16..108, high >= low
  "avg_pitch_error_cents": 21.5,             // optional
  "client_generated_id": "uuid",             // optional, idempotent
  "recorded_at": "2026-09-08T12:00:00Z",     // optional
  "apply_to_profile": true                   // optional: also update users.range_*
}
```
`201`/`200`: `{ "snapshot_id": 12, "state": { ... } }`

### `POST /pitch-sessions` · auth
Store the **aggregates** of one practice session. No raw audio, no per‑frame data.
```json
{
  "module": "pitch",                         // required, one of the 6 modules
  "exercise_id": "ex-pitch-falling-1",       // optional
  "avg_score": 0.71, "avg_error_cents": 28.4, // required
  "duration_seconds": 122,                   // required, 1..7200
  "notes_total": 40, "notes_in_tune": 31,    // optional, in_tune <= total
  "client_generated_id": "uuid",             // optional, idempotent
  "occurred_at": "2026-09-08T12:00:00Z"      // optional
}
```
`201`/`200`: `{ "session_id": 8 }`

---

## Sync  ·  `POST /sync` · auth · `throttle:sync`

The offline‑first batch endpoint. The PWA queues events in IndexedDB while
offline or logged out and flushes them here.

```json
{
  "idempotency_key": "batch-uuid",           // required
  "device_id": "chrome-9f2",                 // optional
  "events": [
    { "type": "exercise_result", "client_generated_id": "uuid",
      "exercise_id": "ex-pitch-falling-1", "score": 0.82,
      "metrics": { "perfectNotes": 4 }, "occurred_at": "2026-09-07T10:00:00Z" },

    { "type": "xp", "client_generated_id": "uuid",
      "source_module": "pitch", "source_exercise_id": "ex-pitch-falling-1",
      "amount": 40, "occurred_at": "2026-09-07T10:00:00Z" },

    { "type": "vocal_range", "client_generated_id": "uuid",
      "low_midi": 48, "high_midi": 70, "avg_pitch_error_cents": 21.5,
      "recorded_at": "2026-09-07T10:05:00Z" },

    { "type": "pitch_session", "client_generated_id": "uuid",
      "module": "pitch", "avg_score": 0.7, "avg_error_cents": 30,
      "duration_seconds": 120, "occurred_at": "2026-09-07T10:04:00Z" },

    { "type": "achievement_unlock", "achievement_id": "first-note",
      "unlocked_at": "2026-09-07T10:00:05Z" }
  ]
}
```

`200`:
```json
{
  "batch": {
    "id": "server-batch-uuid",
    "events_received": 5,
    "events_applied": 4,
    "events_rejected": 1,
    "server_unlocked_achievements": ["first-exercise"],
    "errors": [
      { "index": 1, "type": "xp", "errors": { "amount": ["XP 99999 excede el maximo permitido (76) para este evento."] } }
    ]
  },
  "state": { ...full state... },
  "replayed_batch": false
}
```

### Conflict resolution

| Event / field | Rule |
| --- | --- |
| `exercise_result` | Runs the same path as `POST /exercises/{id}/result`. **Best wins**: `stars` and `best_score` take the max, `attempts` add up, `metrics` merge per‑key by max. |
| `unit_progress` | Never sent by the client — recomputed from `exercise_results` after each event, including the unlock cascade. |
| `xp` (explicit) | **Additive**. Deduped by `client_generated_id`. Rejected if `amount` exceeds the per‑exercise cap (or the global hard cap for module‑only events). `xp_total` is re‑summed from the ledger at the end of the batch. |
| `achievement_unlock` | **Monotonic**. A claim is only honoured if the server can independently verify the condition is met; achievements are never removed. The server also re‑derives all achievements at the end of the batch and unions them in. |
| `streak` | `StreakService` is monotonic: it ignores days older than the last recorded activity and never decreases `current`, so two devices converge on the most advanced coherent value. One missed day is forgiven once per week (`VOXQUEST_STREAK_GRACE_DAYS`). |
| Whole batch | `sync_batches (user, idempotency_key)` unique. A retried batch returns the cached `state` with `replayed_batch: true`. |
| Multi‑device | Every event id is unique per user, so replaying another device's events is a no‑op. |

A malformed batch (missing `idempotency_key`, `events` not an array, > 500 events)
is `422`. A single bad event does **not** fail the batch — it is counted in
`events_rejected` with an entry in `errors`.

---

## Leaderboards

Both are cached ~60 s (Redis when `CACHE_STORE=redis`, else the default store)
and keyed by ISO week / day so they roll over automatically.

### `GET /leaderboards/weekly-xp` · auth
Ranks by **XP earned in the current ISO week** (Mon–Sun UTC), not lifetime XP.
```json
{
  "week": "2026-W37",
  "top": [ { "rank": 1, "user_id": 4, "name": "Bob", "xp": 620 }, ... up to 50 ],
  "me":  { "rank": 73, "xp": 40 }        // rank is null if you earned 0 this week
}
```

### `GET /leaderboards/streaks` · auth
Ranks by longest **active** streak (practised today or yesterday; stale streaks
excluded).
```json
{
  "top": [ { "rank": 1, "user_id": 9, "name": "Ana", "streak": 41 }, ... up to 50 ],
  "me":  { "rank": 12, "streak": 6, "active": true }
}
```

---

## Admin  ·  `is_admin` users only

### `GET /admin/metrics` · auth + `admin`
`403` for non‑admins. `200`:
```json
{
  "generated_at": "2026-09-08T12:00:00+00:00",
  "users_total": 128,
  "users_onboarded": 97,
  "active_users_7d": 41,
  "exercises_completed_total": 612,
  "exercise_attempts_total": 1830,
  "xp_awarded_total": 84210,
  "achievements_unlocked_total": 233,
  "voice_type_distribution": { "tenor": 30, "soprano": 25, "unclassified": 18, ... },
  "completions_by_module": { "pitch": 240, "breath": 150, ... }
}
```
Same data from the CLI: `php artisan voxquest:metrics` (add `--json` for raw).

To grant admin locally: `php artisan tinker` → `User::where('email','…')->update(['is_admin'=>true]);`

---

## Curl quickstart

```bash
BASE=http://localhost:8000/api/v1

# register
TOKEN=$(curl -s -X POST $BASE/auth/register -H 'Accept: application/json' \
  -d name=Steeven -d email=steeven@example.com -d password=secret123 -d password_confirmation=secret123 \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

AUTH="-H \"Authorization: Bearer $TOKEN\" -H 'Accept: application/json'"

# complete an exercise
curl -s -X POST $BASE/exercises/ex-pitch-falling-1/result \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"score":0.82,"metrics":{"perfectNotes":4}}'

# read consolidated state
curl -s $BASE/state -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'

# sync a batch
curl -s -X POST $BASE/sync -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{
    "idempotency_key":"'"$(uuidgen)"'",
    "events":[{"type":"exercise_result","client_generated_id":"'"$(uuidgen)"'","exercise_id":"ex-pitch-echo-1","score":0.9}]
  }'

# leaderboards
curl -s $BASE/leaderboards/weekly-xp -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'
```
