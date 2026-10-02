<?php

use App\Models\User;

beforeEach(function () {
    $this->seed(\Database\Seeders\AchievementSeeder::class);
});

it('forbids non-admins', function () {
    [$user, $headers] = actingAsUser(['is_admin' => false]);

    $this->getJson('/api/v1/admin/metrics', $headers)->assertForbidden();
});

it('returns aggregate metrics for an admin', function () {
    $admin = User::factory()->admin()->create();
    $headers = ['Authorization' => 'Bearer '.$admin->createToken('t')->plainTextToken, 'Accept' => 'application/json'];

    // generate some activity
    $alice = User::factory()->create(['voice_type_key' => 'soprano']);
    record($alice, 'ex-pitch-falling-1', 0.8);
    record($alice, 'boss-breath-1', 0.9);

    $res = $this->getJson('/api/v1/admin/metrics', $headers)->assertOk();

    $res->assertJsonStructure([
        'generated_at', 'users_total', 'users_onboarded', 'active_users_7d',
        'exercises_completed_total', 'exercise_attempts_total', 'xp_awarded_total',
        'achievements_unlocked_total', 'voice_type_distribution', 'completions_by_module',
    ]);

    expect($res->json('active_users_7d'))->toBe(1)
        ->and($res->json('exercises_completed_total'))->toBe(2)
        ->and($res->json('xp_awarded_total'))->toBeGreaterThan(0)
        ->and($res->json('voice_type_distribution.soprano'))->toBe(1);
});

it('runs the artisan metrics command', function () {
    $this->artisan('voxquest:metrics')->assertSuccessful();
    $this->artisan('voxquest:metrics --json')->assertSuccessful();
});
