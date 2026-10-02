<?php

use App\Models\Streak;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Support\Carbon;

function weekXp(User $user, int $amount, ?Carbon $at = null): void
{
    XpEvent::factory()->for($user)->create([
        'amount' => $amount,
        'created_at' => $at ?? Carbon::now(),
        'occurred_at' => $at ?? Carbon::now(),
        'client_generated_id' => (string) Illuminate\Support\Str::uuid(),
    ]);
}

it('ranks the weekly XP board by xp earned this week, not lifetime', function () {
    $alice = User::factory()->create(['name' => 'Alice', 'xp_total' => 999999]); // huge lifetime
    $bob = User::factory()->create(['name' => 'Bob']);

    weekXp($alice, 30);                                   // this week
    weekXp($alice, 200, Carbon::now()->subWeeks(2));      // old, must not count
    weekXp($bob, 120);                                    // this week

    [$viewer, $headers] = actingAsUser(['name' => 'Cara']);
    weekXp($viewer, 10);

    $res = $this->getJson('/api/v1/leaderboards/weekly-xp', $headers)->assertOk();

    expect($res->json('top.0.name'))->toBe('Bob')
        ->and($res->json('top.0.xp'))->toBe(120)
        ->and($res->json('top.1.name'))->toBe('Alice')
        ->and($res->json('top.1.xp'))->toBe(30)
        ->and($res->json('me.xp'))->toBe(10)
        ->and($res->json('me.rank'))->toBe(3);
});

it('gives the viewer a rank even when outside the top list', function () {
    // 3 users ahead of the viewer this week
    foreach (['A', 'B', 'C'] as $n) {
        weekXp(User::factory()->create(['name' => $n]), 500);
    }
    [$viewer, $headers] = actingAsUser();
    weekXp($viewer, 5);

    $res = $this->getJson('/api/v1/leaderboards/weekly-xp', $headers)->assertOk();

    expect($res->json('me.rank'))->toBe(4)
        ->and($res->json('me.xp'))->toBe(5);
});

it('ranks longest active streaks and excludes stale ones', function () {
    $active = User::factory()->create(['name' => 'Active']);
    Streak::create(['user_id' => $active->id, 'current_count' => 12, 'longest_count' => 12, 'last_activity_date' => Carbon::today('UTC')->toDateString()]);

    $stale = User::factory()->create(['name' => 'Stale']);
    Streak::create(['user_id' => $stale->id, 'current_count' => 99, 'longest_count' => 99, 'last_activity_date' => Carbon::today('UTC')->subDays(10)->toDateString()]);

    [$viewer, $headers] = actingAsUser(['name' => 'Me']);
    Streak::create(['user_id' => $viewer->id, 'current_count' => 4, 'longest_count' => 4, 'last_activity_date' => Carbon::today('UTC')->toDateString()]);

    $res = $this->getJson('/api/v1/leaderboards/streaks', $headers)->assertOk();

    $names = array_column($res->json('top'), 'name');
    expect($names)->toContain('Active')
        ->and($names)->not->toContain('Stale')   // 99 but stale
        ->and($res->json('top.0.name'))->toBe('Active')
        ->and($res->json('me.rank'))->toBe(2)
        ->and($res->json('me.active'))->toBeTrue();
});

it('serves the weekly board from cache on the second hit', function () {
    [$viewer, $headers] = actingAsUser();
    weekXp($viewer, 10);

    $this->getJson('/api/v1/leaderboards/weekly-xp', $headers)->assertOk();

    // mutate the underlying data; cached "top" should not reflect it yet
    weekXp(User::factory()->create(['name' => 'LateComer']), 5000);

    $cached = $this->getJson('/api/v1/leaderboards/weekly-xp', $headers)->assertOk();
    expect(collect($cached->json('top'))->pluck('name'))->not->toContain('LateComer');
});
