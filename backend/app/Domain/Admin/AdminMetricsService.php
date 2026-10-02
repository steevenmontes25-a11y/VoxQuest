<?php

declare(strict_types=1);

namespace App\Domain\Admin;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Minimal aggregate metrics. Deliberately just a few numbers — no dashboard.
 */
class AdminMetricsService
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $sevenDaysAgo = Carbon::now()->subDays(7);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'users_total' => (int) DB::table('users')->count(),
            'users_onboarded' => (int) DB::table('users')->whereNotNull('onboarded_at')->count(),
            'active_users_7d' => (int) DB::table('xp_events')
                ->where('created_at', '>=', $sevenDaysAgo)
                ->distinct('user_id')
                ->count('user_id'),
            'exercises_completed_total' => (int) DB::table('exercise_results')->count(),
            'exercise_attempts_total' => (int) DB::table('exercise_results')->sum('attempts'),
            'xp_awarded_total' => (int) DB::table('xp_events')->sum('amount'),
            'achievements_unlocked_total' => (int) DB::table('user_achievements')->count(),
            'voice_type_distribution' => DB::table('users')
                ->selectRaw('COALESCE(voice_type_key, \'unclassified\') as voice_type, COUNT(*) as count')
                ->groupBy('voice_type')
                ->orderByDesc('count')
                ->pluck('count', 'voice_type')
                ->all(),
            'completions_by_module' => DB::table('exercise_results')
                ->selectRaw('module, COUNT(*) as count')
                ->groupBy('module')
                ->orderByDesc('count')
                ->pluck('count', 'module')
                ->all(),
        ];
    }
}
