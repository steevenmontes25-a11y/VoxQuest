<?php

use App\Models\ExerciseResult;
use App\Models\Streak;
use App\Models\User;
use App\Models\XpEvent;
use Laravel\Sanctum\PersonalAccessToken;

it('returns the current profile', function () {
    [$user, $headers] = actingAsUser(['name' => 'Steeven']);

    $this->getJson('/api/v1/profile', $headers)
        ->assertOk()
        ->assertJsonPath('data.name', 'Steeven');
});

it('stores the client-detected vocal range verbatim and marks onboarded once', function () {
    [$user, $headers] = actingAsUser();
    $user->update(['onboarded_at' => null]);

    $this->patchJson('/api/v1/profile', [
        'voice_type_key' => 'baritone',
        'voice_type_label' => 'Baritono',
        'range_low_midi' => 45,
        'range_high_midi' => 64,
        'mark_onboarded' => true,
    ], $headers)->assertOk()
        ->assertJsonPath('data.voice.type_key', 'baritone')
        ->assertJsonPath('data.voice.range_low_midi', 45)
        ->assertJsonPath('data.onboarded', true);

    $first = $user->refresh()->onboarded_at;

    // second call must not move onboarded_at
    $this->patchJson('/api/v1/profile', ['mark_onboarded' => true], $headers)->assertOk();
    expect($user->refresh()->onboarded_at->equalTo($first))->toBeTrue();
});

it('rejects an inverted vocal range', function () {
    [$user, $headers] = actingAsUser();

    $this->patchJson('/api/v1/profile', ['range_low_midi' => 70, 'range_high_midi' => 50], $headers)
        ->assertStatus(422)->assertJsonValidationErrorFor('range_high_midi');
});

it('hard-deletes the account and every child row', function () {
    [$user, $headers] = actingAsUser();
    XpEvent::factory()->for($user)->count(3)->create();
    ExerciseResult::factory()->for($user)->forExercise('ex-pitch-falling-1')->create();
    Streak::firstOrCreate(['user_id' => $user->id]);

    $this->deleteJson('/api/v1/account', [], $headers)->assertOk();

    expect(User::whereKey($user->id)->exists())->toBeFalse()
        ->and(XpEvent::where('user_id', $user->id)->exists())->toBeFalse()
        ->and(ExerciseResult::where('user_id', $user->id)->exists())->toBeFalse()
        ->and(Streak::whereKey($user->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::where('tokenable_id', $user->id)->exists())->toBeFalse();
});
