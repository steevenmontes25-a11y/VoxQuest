<?php

declare(strict_types=1);

namespace App\Domain\Streaks;

use App\Models\Streak;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Daily practice streak. Mirrors the frontend touchStreak() but adds an optional
 * grace window (VOXQUEST_STREAK_GRACE_DAYS): missing a single day is forgiven
 * once before the streak resets.
 *
 * Timezone: dates are treated in UTC. `occurredOn` is the calendar day the
 * activity happened on (from the event, not the request), so replaying an
 * offline session still credits the right day.
 */
class StreakService
{
    private const GRACE_COOLDOWN_DAYS = 7;

    public function graceDays(): int
    {
        return max(0, (int) config('voxquest.streak.grace_days', 0));
    }

    private function graceAvailable(\App\Models\Streak $streak, Carbon $day): bool
    {
        return $streak->grace_used_on === null
            || $streak->grace_used_on->copy()->startOfDay()
                ->lessThan($day->copy()->subDays(self::GRACE_COOLDOWN_DAYS));
    }

    public function touch(User $user, Carbon $occurredOn): Streak
    {
        $day = $occurredOn->copy()->startOfDay();

        /** @var Streak $streak */
        $streak = Streak::query()->lockForUpdate()->firstOrCreate(['user_id' => $user->id]);

        $last = $streak->last_activity_date?->copy()->startOfDay();

        // Out-of-order / same day: never decrease, never double count.
        if ($last !== null && $day->lessThanOrEqualTo($last)) {
            return $streak;
        }

        if ($last === null) {
            $streak->current_count = 1;
        } else {
            // Carbon 3 returns a float; both operands are start-of-day so this is
            // a whole number of days, and > 0 because of the guard above.
            $gap = (int) round($last->diffInDays($day));

            if ($gap === 1) {
                $streak->current_count++;
            } elseif ($this->graceDays() > 0 && $gap <= $this->graceDays() + 1 && $this->graceAvailable($streak, $day)) {
                // Forgive the missed day(s) and burn the grace. It only comes back
                // after GRACE_COOLDOWN_DAYS of not needing it, so repeatedly
                // skipping every other day is not a "streak".
                $streak->current_count++;
                $streak->grace_used_on = $day->toDateString();
            } else {
                $streak->current_count = 1;
            }
        }

        $streak->longest_count = max($streak->longest_count, $streak->current_count);
        $streak->last_activity_date = $day->toDateString();
        $streak->save();

        return $streak;
    }
}
