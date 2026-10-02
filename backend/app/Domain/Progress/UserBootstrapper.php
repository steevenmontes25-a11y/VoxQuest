<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use App\Models\Streak;
use App\Models\UnitProgress;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Puts a brand-new account into the same starting state as a fresh frontend
 * IndexedDB save: a streak row and one unit_progress row per catalog unit
 * (initial units unlocked, the rest locked).
 */
class UserBootstrapper
{
    public function bootstrap(User $user): void
    {
        Streak::query()->firstOrCreate(['user_id' => $user->id]);

        $units = config('voxquest.units');
        $exercises = config('voxquest.exercises');
        $initial = config('voxquest.initial_unlocked_units');
        $now = Carbon::now();

        $rows = [];
        foreach ($units as $unitId => $unit) {
            $exerciseCount = collect($exercises)->where('unit', $unitId)->count();
            $unlocked = in_array($unitId, $initial, true);

            $rows[] = [
                'user_id' => $user->id,
                'unit_id' => $unitId,
                'module' => $unit['module'],
                'status' => $unlocked ? 'in_progress' : 'locked',
                'stars_earned' => 0,
                'stars_possible' => $exerciseCount * 3,
                'exercises_cleared' => 0,
                'best_score' => 0,
                'unlocked_at' => $unlocked ? $now : null,
                'completed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        UnitProgress::query()->upsert(
            $rows,
            uniqueBy: ['user_id', 'unit_id'],
            update: ['module', 'stars_possible'],
        );
    }
}
