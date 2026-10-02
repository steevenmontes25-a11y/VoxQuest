<?php

use App\Models\ExerciseResult;
use App\Models\UnitProgress;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Support\Str;

it('appends a ledger event, upserts the result and bumps xp_total', function () {
    $user = User::factory()->create(['xp_total' => 0]);

    $outcome = record($user, 'ex-pitch-falling-1', 0.8);

    expect($outcome->applied)->toBeTrue()
        ->and($outcome->stars)->toBe(2)            // 0.8 -> 2 stars
        ->and($outcome->firstClear)->toBeTrue();

    // 55 * (0.5+0.4=0.9) * (1+0.3=1.3) * 1.5 = 96.525 -> 97
    expect($outcome->xpGained)->toBe(97);
    expect($user->fresh()->xp_total)->toBe(97);
    expect(XpEvent::where('user_id', $user->id)->count())->toBe(1);
    expect(ExerciseResult::where('user_id', $user->id)->where('exercise_id', 'ex-pitch-falling-1')->value('stars'))->toBe(2);
});

it('rejects an unknown exercise id', function () {
    $user = User::factory()->create();

    expect(fn () => record($user, 'ex-does-not-exist', 0.9))
        ->toThrow(Illuminate\Validation\ValidationException::class);
});

it('is idempotent on client_generated_id (replay is a no-op)', function () {
    $user = User::factory()->create(['xp_total' => 0]);
    $cgid = (string) Str::uuid();

    $first = record($user, 'ex-pitch-echo-1', 0.9, ['client_generated_id' => $cgid]);
    $replay = record($user, 'ex-pitch-echo-1', 0.9, ['client_generated_id' => $cgid]);

    expect($first->applied)->toBeTrue()
        ->and($replay->applied)->toBeFalse()
        ->and($replay->xpGained)->toBe(0);

    expect(XpEvent::where('user_id', $user->id)->count())->toBe(1);
    expect($user->fresh()->xp_total)->toBe($first->xpGained);
});

it('keeps the best result when a later attempt is worse', function () {
    $user = User::factory()->create();

    record($user, 'ex-interval-fifth', 0.60); // 1 star
    record($user, 'ex-interval-fifth', 0.95); // 3 stars
    record($user, 'ex-interval-fifth', 0.50); // 0 stars, must not downgrade

    $result = ExerciseResult::where('user_id', $user->id)->where('exercise_id', 'ex-interval-fifth')->first();

    expect($result->stars)->toBe(3)
        ->and((float) $result->best_score)->toBe(0.95)
        ->and($result->attempts)->toBe(3);
});

it('merges metrics by max', function () {
    $user = User::factory()->create();

    record($user, 'ex-tech-vibrato', 0.8, ['metrics' => ['vibratoSeconds' => 2.0]]);
    record($user, 'ex-tech-vibrato', 0.4, ['metrics' => ['vibratoSeconds' => 5.5, 'wobble' => 3]]);

    $metrics = ExerciseResult::where('user_id', $user->id)->where('exercise_id', 'ex-tech-vibrato')->value('metrics');

    expect($metrics['vibratoSeconds'])->toBe(5.5)
        ->and($metrics['wobble'])->toBe(3);
});

it('caps a tampered metric value', function () {
    $user = User::factory()->create();

    record($user, 'ex-breath-candle', 0.7, ['metrics' => ['airSeconds' => 999999]]);

    $metrics = ExerciseResult::where('user_id', $user->id)->where('exercise_id', 'ex-breath-candle')->value('metrics');
    expect($metrics['airSeconds'])->toBeLessThanOrEqual(3600);
});

it('never awards more than the per-exercise cap even with score 1 and first clear', function () {
    $user = User::factory()->create(['xp_total' => 0]);

    $outcome = record($user, 'boss-pitch-1', 1.0);

    expect($outcome->xpGained)->toBeLessThanOrEqual(app(App\Domain\Xp\XpCalculator::class)->maxXpForExercise('boss-pitch-1'))
        ->and($outcome->xpGained)->toBe(305);
});

it('unlocks the next unit only after every exercise of the prerequisite has a star', function () {
    $user = User::factory()->create();
    app(App\Domain\Progress\UserBootstrapper::class)->bootstrap($user);

    // u-pitch-1 has three exercises. Clear two -> u-pitch-2 stays locked.
    record($user, 'ex-pitch-sustain-1', 0.7);
    record($user, 'ex-pitch-falling-1', 0.7);

    expect(UnitProgress::where('user_id', $user->id)->where('unit_id', 'u-pitch-2')->value('status'))->toBe('locked');

    // clear the third -> u-pitch-2 unlocks
    record($user, 'ex-pitch-echo-1', 0.7);

    expect(UnitProgress::where('user_id', $user->id)->where('unit_id', 'u-pitch-1')->value('status'))->toBe('completed');
    expect(UnitProgress::where('user_id', $user->id)->where('unit_id', 'u-pitch-2')->value('status'))->toBe('in_progress');
    // u-tech-1 also requires u-pitch-1
    expect(UnitProgress::where('user_id', $user->id)->where('unit_id', 'u-tech-1')->value('status'))->toBe('in_progress');
    // but u-pitch-3 requires u-pitch-2 which is not cleared yet
    expect(UnitProgress::where('user_id', $user->id)->where('unit_id', 'u-pitch-3')->value('status'))->toBe('locked');
});

it('exposes the same numbers through the HTTP endpoint', function () {
    [$user, $headers] = actingAsUser(['xp_total' => 0]);

    $this->postJson('/api/v1/exercises/ex-pitch-falling-1/result', ['score' => 0.8], $headers)
        ->assertCreated()
        ->assertJsonPath('outcome.applied', true)
        ->assertJsonPath('outcome.xp_gained', 97)
        ->assertJsonPath('outcome.stars', 2)
        ->assertJsonPath('state.xp_total', 97)
        ->assertJsonPath('state.results.ex-pitch-falling-1.stars', 2);
});

it('validates the score range on the endpoint', function () {
    [$user, $headers] = actingAsUser();

    $this->postJson('/api/v1/exercises/ex-pitch-falling-1/result', ['score' => 1.7], $headers)
        ->assertStatus(422)->assertJsonValidationErrorFor('score');
});
