<?php

use App\Domain\Achievements\AchievementEvaluator;
use App\Domain\Streaks\StreakService;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->seed(\Database\Seeders\AchievementSeeder::class);
});

function unlocked(User $user): array
{
    return $user->achievements()->pluck('achievement_id')->sort()->values()->all();
}

it('unlocks "first-exercise" on the very first completion', function () {
    $user = User::factory()->create();

    $outcome = record($user, 'ex-theory-quiz-1', 0.8);

    expect($outcome->newAchievements)->toContain('first-exercise');
    expect(unlocked($user))->toContain('first-exercise');
});

it('unlocks "first-note" from a perfectNotes metric', function () {
    $user = User::factory()->create();

    $outcome = record($user, 'ex-pitch-sustain-1', 0.7, ['metrics' => ['perfectNotes' => 3]]);

    expect($outcome->newAchievements)->toContain('first-note');
});

it('unlocks "fifth-master" only with 3 stars on the fifth interval', function () {
    $user = User::factory()->create();

    record($user, 'ex-interval-fifth', 0.7);           // 1 star
    expect(unlocked($user))->not->toContain('fifth-master');

    $outcome = record($user, 'ex-interval-fifth', 0.95); // 3 stars
    expect($outcome->newAchievements)->toContain('fifth-master');
});

it('unlocks "air-20s" from the airSeconds metric', function () {
    $user = User::factory()->create();

    $outcome = record($user, 'ex-breath-candle', 0.9, ['metrics' => ['airSeconds' => 21]]);

    expect($outcome->newAchievements)->toContain('air-20s');
});

it('unlocks "boss-1" after clearing any boss exercise', function () {
    $user = User::factory()->create();

    $outcome = record($user, 'boss-breath-1', 0.8);

    expect($outcome->newAchievements)->toContain('boss-1');
});

it('unlocks "song-clear" after a repertoire song', function () {
    $user = User::factory()->create();

    $outcome = record($user, 'song-solfeo-1', 0.7);

    expect($outcome->newAchievements)->toContain('song-clear');
});

it('unlocks streak achievements as the streak grows', function () {
    $user = User::factory()->create();
    $streaks = app(StreakService::class);

    foreach (['2026-09-01', '2026-09-02'] as $d) {
        $streaks->touch($user, Carbon::parse($d));
    }
    expect(app(AchievementEvaluator::class)->evaluateAndUnlock($user->fresh()))->not->toContain('streak-3');

    $streaks->touch($user, Carbon::parse('2026-09-03'));
    expect(app(AchievementEvaluator::class)->evaluateAndUnlock($user->fresh()))->toContain('streak-3');
});

it('unlocks level milestones from xp_total', function () {
    $xp = app(App\Domain\Xp\XpCalculator::class);
    $user = User::factory()->create(['xp_total' => $xp->xpForLevel(5)]);

    $earned = app(AchievementEvaluator::class)->evaluateAndUnlock($user);

    expect($earned)->toContain('level-5')
        ->and($earned)->not->toContain('level-10');
});

it('is monotonic: a lower later state never revokes an achievement', function () {
    $user = User::factory()->create();

    record($user, 'ex-interval-fifth', 0.95); // fifth-master
    expect(unlocked($user))->toContain('fifth-master');

    record($user, 'ex-interval-fifth', 0.2);  // worse; still 3 stars stored
    expect(unlocked($user))->toContain('fifth-master');
});

it('never unlocks the same achievement twice', function () {
    $user = User::factory()->create();

    record($user, 'ex-theory-quiz-1', 0.8);
    record($user, 'ex-theory-quiz-1', 0.9);

    expect($user->achievements()->where('achievement_id', 'first-exercise')->count())->toBe(1);
});
