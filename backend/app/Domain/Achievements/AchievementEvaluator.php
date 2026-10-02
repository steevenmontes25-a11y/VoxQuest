<?php

declare(strict_types=1);

namespace App\Domain\Achievements;

use App\Domain\Xp\XpCalculator;
use App\Models\Achievement;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Evaluates the achievement catalog (config/voxquest.php -> DB) against a user's
 * consolidated state. Mirrors the `check` closures in src/game/achievements.ts.
 *
 * Achievements are MONOTONIC: once earned they are never revoked, and the client
 * can never remove one during sync.
 */
class AchievementEvaluator
{
    public function __construct(private readonly XpCalculator $xp) {}

    /**
     * Persist any newly-earned achievements for the user and return their ids.
     *
     * @return list<string>
     */
    public function evaluateAndUnlock(User $user): array
    {
        $already = $user->achievements()->pluck('achievement_id')->all();

        $state = $this->snapshot($user);

        $newlyEarned = Achievement::query()
            ->whereNotIn('id', $already)
            ->get()
            ->filter(fn (Achievement $a): bool => $this->satisfies($a->rule, $state))
            ->pluck('id')
            ->values();

        if ($newlyEarned->isEmpty()) {
            return [];
        }

        $now = Carbon::now();
        $user->achievements()->insert(
            $newlyEarned->map(fn (string $id): array => [
                'user_id' => $user->id,
                'achievement_id' => $id,
                'unlocked_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all()
        );

        return $newlyEarned->all();
    }

    /**
     * @param array<string, mixed> $rule
     * @param array<string, mixed> $state
     */
    private function satisfies(array $rule, array $state): bool
    {
        return match ($rule['type']) {
            'metric_at_least' => ($state['max_metrics'][$rule['key']] ?? null) !== null
                && $state['max_metrics'][$rule['key']] >= $rule['value'],

            'exercises_completed' => $state['exercises_completed'] >= $rule['value'],

            'streak_at_least' => $state['streak_current'] >= $rule['value']
                || $state['streak_longest'] >= $rule['value'],

            'level_at_least' => $state['level'] >= $rule['value'],

            'exercise_stars_at_least' => ($state['stars_by_exercise'][$rule['exercise']] ?? 0) >= $rule['value'],

            'total_stars_at_least' => $state['total_stars'] >= $rule['value'],

            'exercise_prefix_completed' => collect($state['completed_exercise_ids'])
                ->contains(fn (string $id): bool => str_starts_with($id, $rule['prefix'])),

            default => false,
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(User $user): array
    {
        /** @var Collection<int, \App\Models\ExerciseResult> $results */
        $results = $user->exerciseResults()->get();
        $streak = $user->streakRow();

        // per-metric max across every exercise result
        $maxMetrics = [];
        foreach ($results as $r) {
            foreach (($r->metrics ?? []) as $k => $v) {
                if (! is_numeric($v)) {
                    continue;
                }
                $maxMetrics[$k] = isset($maxMetrics[$k]) ? max($maxMetrics[$k], $v) : $v;
            }
        }

        return [
            'level' => $this->xp->levelForXp((int) $user->xp_total),
            'streak_current' => (int) $streak->current_count,
            'streak_longest' => (int) $streak->longest_count,
            'exercises_completed' => $results->count(),
            'total_stars' => (int) $results->sum('stars'),
            'stars_by_exercise' => $results->pluck('stars', 'exercise_id')->all(),
            'completed_exercise_ids' => $results->pluck('exercise_id')->all(),
            'max_metrics' => $maxMetrics,
        ];
    }
}
