<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use App\Models\ExerciseResult;
use App\Models\UnitProgress;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Recomputes unit_progress rows from exercise_results and applies the unlock
 * cascade. Mirrors the frontend rule: a unit "clears" when every one of its
 * exercises has >= 1 star, and clearing a unit unlocks any unit that `requires`
 * it. Runs to a fixed point so a chain (u-pitch-1 -> u-pitch-2 -> u-pitch-3)
 * can unlock in a single call.
 */
class UnitProgressRecalculator
{
    public function recalculate(User $user): void
    {
        $units = config('voxquest.units');
        $exercises = config('voxquest.exercises');
        $now = Carbon::now();

        /** @var array<string, \App\Models\ExerciseResult> $resultsByExercise */
        $resultsByExercise = ExerciseResult::query()
            ->where('user_id', $user->id)
            ->get()
            ->keyBy('exercise_id');

        /** @var array<string, UnitProgress> $progressByUnit */
        $progressByUnit = UnitProgress::query()
            ->where('user_id', $user->id)
            ->get()
            ->keyBy('unit_id');

        $cleared = [];  // unit_id => bool  (all exercises >= 1 star)

        foreach ($units as $unitId => $unit) {
            $unitExerciseIds = array_keys(array_filter(
                $exercises,
                fn (array $e): bool => $e['unit'] === $unitId
            ));

            $starsEarned = 0;
            $exercisesCleared = 0;
            $bestScore = 0.0;
            foreach ($unitExerciseIds as $exId) {
                $r = $resultsByExercise->get($exId);
                if ($r === null) {
                    continue;
                }
                $starsEarned += (int) $r->stars;
                $bestScore = max($bestScore, (float) $r->best_score);
                if ((int) $r->stars >= 1) {
                    $exercisesCleared++;
                }
            }

            $allCleared = count($unitExerciseIds) > 0 && $exercisesCleared === count($unitExerciseIds);
            $cleared[$unitId] = $allCleared;

            $row = $progressByUnit->get($unitId) ?? new UnitProgress([
                'user_id' => $user->id,
                'unit_id' => $unitId,
                'module' => $unit['module'],
                'status' => 'locked',
            ]);
            $row->user_id = $user->id;
            $row->module = $unit['module'];
            $row->stars_earned = $starsEarned;
            $row->stars_possible = count($unitExerciseIds) * 3;
            $row->exercises_cleared = $exercisesCleared;
            $row->best_score = $bestScore;

            if ($allCleared) {
                $row->status = 'completed';
                $row->completed_at ??= $now;
                $row->unlocked_at ??= $now;
            } elseif ($row->status !== 'locked' || $exercisesCleared > 0 || $starsEarned > 0) {
                $row->status = $row->status === 'completed' ? 'completed' : 'in_progress';
                $row->unlocked_at ??= $now;
            }

            $progressByUnit->put($unitId, $row);
        }

        // Unlock cascade to a fixed point.
        do {
            $changed = false;
            foreach ($units as $unitId => $unit) {
                $req = $unit['requires'];
                if ($req === null) {
                    continue;
                }
                $row = $progressByUnit->get($unitId);
                if ($row === null || $row->status !== 'locked') {
                    continue;
                }
                if (($cleared[$req] ?? false) === true) {
                    $row->status = 'in_progress';
                    $row->unlocked_at ??= $now;
                    $changed = true;
                }
            }
        } while ($changed);

        foreach ($progressByUnit as $row) {
            $row->save();
        }
    }
}
