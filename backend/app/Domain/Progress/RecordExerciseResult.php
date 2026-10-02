<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use App\Domain\Achievements\AchievementEvaluator;
use App\Domain\Streaks\StreakService;
use App\Domain\Xp\XpCalculator;
use App\Models\ExerciseResult;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Support\Facades\DB;

/**
 * THE core write path. Applies one exercise completion atomically:
 *
 *   1. resolve the exercise from the trusted catalog (reject unknown ids)
 *   2. idempotency guard on client_generated_id (replay -> no-op)
 *   3. derive stars + canonical XP server-side (client values ignored / capped)
 *   4. append an xp_event  (ledger, never mutated)
 *   5. upsert exercise_results with "best wins" + per-key metric max-merge
 *   6. recompute unit_progress + run the unlock cascade
 *   7. bump users.xp_total (the cache of SUM(xp_events.amount))
 *   8. touch the daily streak for the day the event occurred
 *   9. evaluate achievements (monotonic)
 *
 * Everything runs inside a single DB::transaction with the user row locked
 * FOR UPDATE, so concurrent syncs from two devices serialise cleanly.
 */
class RecordExerciseResult
{
    public function __construct(
        private readonly XpCalculator $xp,
        private readonly StreakService $streaks,
        private readonly AchievementEvaluator $achievements,
        private readonly UnitProgressRecalculator $units,
    ) {}

    public function handle(User $user, RecordExercisePayload $payload): RecordExerciseOutcome
    {
        $meta = config("voxquest.exercises.{$payload->exerciseId}");
        if ($meta === null) {
            throw UnknownExerciseException::for($payload->exerciseId);
        }

        return DB::transaction(function () use ($user, $payload, $meta): RecordExerciseOutcome {
            /** @var User $user */
            $user = User::query()->lockForUpdate()->findOrFail($user->id);

            // --- 2. idempotency -------------------------------------------------
            $alreadyApplied = XpEvent::query()
                ->where('user_id', $user->id)
                ->where('client_generated_id', $payload->clientGeneratedId)
                ->exists();

            if ($alreadyApplied) {
                return RecordExerciseOutcome::replay();
            }

            // --- 3. derive stars + XP ----------------------------------------
            $score = max(0.0, min(1.0, $payload->score));
            $stars = $this->xp->starsFromScore($score);

            $existing = ExerciseResult::query()
                ->where('user_id', $user->id)
                ->where('exercise_id', $payload->exerciseId)
                ->lockForUpdate()
                ->first();

            $firstClear = $existing === null;

            $baseXp = (int) $meta['base_xp'];
            $xpAmount = min(
                $this->xp->maxXpForExercise($payload->exerciseId),
                $this->xp->xpForExercise($baseXp, $stars, $score, $firstClear),
            );

            $levelBefore = $this->xp->levelForXp((int) $user->xp_total);

            // --- 4. ledger ----------------------------------------------------
            XpEvent::query()->create([
                'user_id' => $user->id,
                'amount' => $xpAmount,
                'source_module' => $meta['module'],
                'source_exercise_id' => $payload->exerciseId,
                'stars' => $stars,
                'score' => round($score, 3),
                'first_clear' => $firstClear,
                'client_generated_id' => $payload->clientGeneratedId,
                'sync_batch_id' => $payload->syncBatchId,
                'occurred_at' => $payload->occurredAtOrNow(),
            ]);

            // --- 5. exercise_results: best wins -----------------------------
            $mergedMetrics = $this->mergeMetricsMax($existing?->metrics ?? [], $payload->metrics);
            $occurredAt = $payload->occurredAtOrNow();

            if ($existing) {
                $existing->fill([
                    'stars' => max((int) $existing->stars, $stars),
                    'best_score' => max((float) $existing->best_score, $score),
                    'attempts' => (int) $existing->attempts + 1,
                    'metrics' => $mergedMetrics,
                    'last_played_at' => $existing->last_played_at && $existing->last_played_at->greaterThan($occurredAt)
                        ? $existing->last_played_at
                        : $occurredAt,
                ])->save();
            } else {
                ExerciseResult::query()->create([
                    'user_id' => $user->id,
                    'exercise_id' => $payload->exerciseId,
                    'unit_id' => $meta['unit'],
                    'module' => $meta['module'],
                    'stars' => $stars,
                    'best_score' => $score,
                    'attempts' => 1,
                    'metrics' => $mergedMetrics,
                    'last_played_at' => $occurredAt,
                ]);
            }

            // --- 6. unit rollup + unlock cascade ---------------------------
            $this->units->recalculate($user);

            // --- 7. xp_total cache -----------------------------------------
            $user->xp_total = (int) XpEvent::query()->where('user_id', $user->id)->sum('amount');
            $user->save();
            $levelAfter = $this->xp->levelForXp((int) $user->xp_total);

            // --- 8. streak ------------------------------------------------
            $this->streaks->touch($user, $occurredAt);

            // --- 9. achievements ----------------------------------------
            $newAchievements = $this->achievements->evaluateAndUnlock($user->fresh());

            return new RecordExerciseOutcome(
                applied: true,
                xpGained: $xpAmount,
                stars: $stars,
                firstClear: $firstClear,
                leveledUp: $levelAfter > $levelBefore,
                levelBefore: $levelBefore,
                levelAfter: $levelAfter,
                newAchievements: $newAchievements,
            );
        });
    }

    /**
     * @param array<string, float|int>|null $current
     * @param array<string, float|int> $incoming
     * @return array<string, float|int>
     */
    private function mergeMetricsMax(?array $current, array $incoming): array
    {
        $out = $current ?? [];
        foreach ($incoming as $key => $value) {
            $out[$key] = isset($out[$key]) ? max($out[$key], $value) : $value;
        }

        return $out;
    }
}
