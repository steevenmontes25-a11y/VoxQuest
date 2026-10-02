<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use App\Domain\Xp\XpCalculator;
use App\Models\User;

/**
 * Builds the full server-authoritative state the client reconciles its local
 * IndexedDB copy against. Returned by GET /api/v1/state and by POST /api/v1/sync.
 *
 * Shape is intentionally close to the frontend PersistedState so the client can
 * merge field-by-field.
 */
class ConsolidatedStateBuilder
{
    public function __construct(private readonly XpCalculator $xp) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $user): array
    {
        $user->loadMissing(['exerciseResults', 'unitProgress', 'achievements', 'streak']);

        $level = $this->xp->levelFromXp((int) $user->xp_total);
        $streak = $user->streak;

        $results = $user->exerciseResults
            ->keyBy('exercise_id')
            ->map(fn ($r): array => [
                'exercise_id' => $r->exercise_id,
                'unit_id' => $r->unit_id,
                'module' => $r->module,
                'stars' => (int) $r->stars,
                'best_score' => (float) $r->best_score,
                'attempts' => (int) $r->attempts,
                'metrics' => (object) ($r->metrics ?? []),
                'last_played_at' => $r->last_played_at?->toIso8601String(),
            ]);

        $units = $user->unitProgress
            ->keyBy('unit_id')
            ->map(fn ($u): array => [
                'unit_id' => $u->unit_id,
                'module' => $u->module,
                'status' => $u->status,
                'stars_earned' => (int) $u->stars_earned,
                'stars_possible' => (int) $u->stars_possible,
                'exercises_cleared' => (int) $u->exercises_cleared,
                'best_score' => (float) $u->best_score,
                'unlocked' => $u->status !== 'locked',
                'completed_at' => $u->completed_at?->toIso8601String(),
            ]);

        return [
            'server_time' => now()->toIso8601String(),
            'profile' => [
                'name' => $user->name,
                'onboarded' => $user->onboarded_at !== null,
                'voice_type_key' => $user->voice_type_key,
                'voice_type_label' => $user->voice_type_label,
                'range_low_midi' => $user->range_low_midi,
                'range_high_midi' => $user->range_high_midi,
            ],
            'xp_total' => (int) $user->xp_total,
            'level' => $level['level'],
            'level_into' => $level['into_level'],
            'level_span' => $level['span'],
            'level_progress' => $level['progress'],
            'streak' => [
                'current' => (int) ($streak->current_count ?? 0),
                'longest' => (int) ($streak->longest_count ?? 0),
                'last_activity_date' => $streak?->last_activity_date?->toDateString(),
            ],
            'unlocked_units' => $units->where('unlocked', true)->keys()->values()->all(),
            'results' => $results,
            'units' => $units,
            'achievements' => $user->achievements
                ->map(fn ($a): array => [
                    'id' => $a->achievement_id,
                    'unlocked_at' => $a->unlocked_at?->toIso8601String(),
                ])->values()->all(),
        ];
    }
}
