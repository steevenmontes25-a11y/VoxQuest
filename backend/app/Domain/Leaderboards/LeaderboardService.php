<?php

declare(strict_types=1);

namespace App\Domain\Leaderboards;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Read-heavy, so every board is cached briefly (Redis when configured, otherwise
 * the default cache store). Cache keys include the ISO week so they roll over
 * automatically.
 */
class LeaderboardService
{
    private const TOP = 50;

    private const TTL_SECONDS = 60;

    /**
     * Weekly ranking by XP *earned this ISO week* (not lifetime XP) so a new
     * player can still top the board.
     *
     * @return array{week: string, top: list<array{rank:int,user_id:int,name:string,xp:int}>, me: array{rank:int|null,xp:int}}
     */
    public function weeklyXp(User $viewer): array
    {
        [$start, $end] = $this->currentIsoWeekBounds();
        $weekKey = $start->isoFormat('GGGG-[W]WW');

        $top = Cache::remember(
            "leaderboard:weekly-xp:{$weekKey}",
            self::TTL_SECONDS,
            fn () => $this->weeklyXpQuery($start, $end)
                ->limit(self::TOP)
                ->get()
                ->values()
                ->map(fn ($row, $i): array => [
                    'rank' => $i + 1,
                    'user_id' => (int) $row->user_id,
                    'name' => (string) $row->name,
                    'xp' => (int) $row->xp,
                ])->all(),
        );

        $myXp = (int) DB::table('xp_events')
            ->where('user_id', $viewer->id)
            ->whereBetween('created_at', [$start, $end])
            ->sum('amount');

        return [
            'week' => $weekKey,
            'top' => $top,
            'me' => [
                'rank' => $myXp > 0 ? $this->rankForWeeklyXp($start, $end, $viewer, $myXp) : null,
                'xp' => $myXp,
            ],
        ];
    }

    /**
     * Ranking by longest *active* streak. A streak counts as active if the user
     * practised today or yesterday; otherwise it is stale and excluded.
     *
     * @return array{top: list<array{rank:int,user_id:int,name:string,streak:int}>, me: array{rank:int|null,streak:int,active:bool}}
     */
    public function longestActiveStreaks(User $viewer): array
    {
        $cutoff = Carbon::today('UTC')->subDay()->toDateString();

        $top = Cache::remember(
            'leaderboard:streaks:'.Carbon::today('UTC')->toDateString(),
            self::TTL_SECONDS,
            fn () => DB::table('streaks')
                ->join('users', 'users.id', '=', 'streaks.user_id')
                ->where('streaks.current_count', '>', 0)
                ->where('streaks.last_activity_date', '>=', $cutoff)
                ->orderByDesc('streaks.current_count')
                ->orderBy('streaks.updated_at')
                ->limit(self::TOP)
                ->get(['streaks.user_id', 'users.name', 'streaks.current_count as streak'])
                ->values()
                ->map(fn ($row, $i): array => [
                    'rank' => $i + 1,
                    'user_id' => (int) $row->user_id,
                    'name' => (string) $row->name,
                    'streak' => (int) $row->streak,
                ])->all(),
        );

        $mine = DB::table('streaks')->where('user_id', $viewer->id)->first();
        $myStreak = (int) ($mine->current_count ?? 0);
        $active = $mine !== null && $mine->last_activity_date !== null && $mine->last_activity_date >= $cutoff;

        $rank = null;
        if ($active && $myStreak > 0) {
            $rank = 1 + (int) DB::table('streaks')
                ->where('current_count', '>', $myStreak)
                ->where('last_activity_date', '>=', $cutoff)
                ->count();
        }

        return [
            'top' => $top,
            'me' => ['rank' => $rank, 'streak' => $myStreak, 'active' => $active],
        ];
    }

    private function weeklyXpQuery(Carbon $start, Carbon $end): \Illuminate\Database\Query\Builder
    {
        return DB::table('xp_events')
            ->join('users', 'users.id', '=', 'xp_events.user_id')
            ->whereBetween('xp_events.created_at', [$start, $end])
            ->groupBy('xp_events.user_id', 'users.name')
            ->orderByDesc('xp')
            ->orderBy('xp_events.user_id')
            ->select('xp_events.user_id', 'users.name', DB::raw('SUM(xp_events.amount) as xp'));
    }

    private function rankForWeeklyXp(Carbon $start, Carbon $end, User $viewer, int $myXp): int
    {
        $perUser = DB::table('xp_events')
            ->select('user_id', DB::raw('SUM(amount) as wk'))
            ->whereBetween('created_at', [$start, $end])
            ->where('user_id', '!=', $viewer->id)
            ->groupBy('user_id');

        $ahead = DB::query()->fromSub($perUser, 'agg')->where('wk', '>', $myXp)->count();

        return $ahead + 1;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function currentIsoWeekBounds(): array
    {
        $start = Carbon::now('UTC')->startOfWeek(Carbon::MONDAY);
        $end = $start->copy()->addWeek();

        return [$start, $end];
    }
}
