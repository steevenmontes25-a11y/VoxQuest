<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature', 'Unit');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

/**
 * Create an authenticated user + Sanctum token and return [User, headers].
 *
 * @return array{0: \App\Models\User, 1: array<string,string>}
 */
function actingAsUser(array $attributes = []): array
{
    $user = \App\Models\User::factory()->create($attributes);
    $token = $user->createToken('test')->plainTextToken;

    return [$user, ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json']];
}

/**
 * Apply one exercise completion through the real domain action.
 */
function record(
    \App\Models\User $user,
    string $exerciseId,
    float $score,
    array $overrides = []
): \App\Domain\Progress\RecordExerciseOutcome {
    $payload = \App\Domain\Progress\RecordExercisePayload::fromArray(array_merge([
        'exercise_id' => $exerciseId,
        'score' => $score,
    ], $overrides));

    return app(\App\Domain\Progress\RecordExerciseResult::class)->handle($user, $payload);
}
