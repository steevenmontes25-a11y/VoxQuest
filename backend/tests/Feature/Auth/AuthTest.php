<?php

use App\Models\Streak;
use App\Models\UnitProgress;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('registers a user, returns a token and bootstraps progress', function () {
    $res = $this->postJson('/api/v1/auth/register', [
        'name' => 'Steeven',
        'email' => 'steeven@example.com',
        'password' => 'secret123',
        'password_confirmation' => 'secret123',
        'device_name' => 'pwa-chrome',
    ]);

    $res->assertCreated()
        ->assertJsonStructure(['token', 'user' => ['id', 'email', 'level', 'xp_total', 'onboarded']])
        ->assertJsonPath('user.email', 'steeven@example.com')
        ->assertJsonPath('user.level', 1)
        ->assertJsonPath('user.xp_total', 0);

    $user = User::firstWhere('email', 'steeven@example.com');
    expect(Hash::check('secret123', $user->password))->toBeTrue();
    expect(Streak::whereKey($user->id)->exists())->toBeTrue();
    // one unit_progress row per catalog unit, initial ones unlocked
    expect(UnitProgress::where('user_id', $user->id)->count())->toBe(count(config('voxquest.units')));
    expect(UnitProgress::where('user_id', $user->id)->where('status', 'in_progress')->pluck('unit_id')->sort()->values()->all())
        ->toBe(collect(config('voxquest.initial_unlocked_units'))->sort()->values()->all());
});

it('rejects a duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'X', 'email' => 'taken@example.com',
        'password' => 'secret123', 'password_confirmation' => 'secret123',
    ])->assertStatus(422)->assertJsonValidationErrorFor('email');
});

it('rejects a weak password', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'X', 'email' => 'weak@example.com',
        'password' => 'short', 'password_confirmation' => 'short',
    ])->assertStatus(422)->assertJsonValidationErrorFor('password');
});

it('logs in with correct credentials', function () {
    User::factory()->create(['email' => 'a@example.com', 'password' => 'secret123']);

    $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'secret123'])
        ->assertOk()
        ->assertJsonStructure(['token', 'user']);
});

it('rejects a wrong password', function () {
    User::factory()->create(['email' => 'a@example.com', 'password' => 'secret123']);

    $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'nope'])
        ->assertStatus(422)->assertJsonValidationErrorFor('email');
});

it('requires a token for /auth/me', function () {
    $this->getJson('/api/v1/auth/me')->assertUnauthorized();

    [$user, $headers] = actingAsUser();
    $this->getJson('/api/v1/auth/me', $headers)->assertOk()->assertJsonPath('data.id', $user->id);
});

it('revokes the current token on logout', function () {
    $user = User::factory()->create();
    $token = $user->createToken('pwa')->plainTextToken;
    $headers = ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json'];

    $this->postJson('/api/v1/auth/logout', [], $headers)->assertOk();

    // The Sanctum guard memoises the resolved user for the lifetime of the
    // application instance, which a test reuses across requests. Forget it so
    // the next call re-reads the (now deleted) token from the database.
    $this->app['auth']->forgetGuards();

    expect(\Laravel\Sanctum\PersonalAccessToken::findToken(explode('|', $token, 2)[1]))->toBeNull();
    $this->getJson('/api/v1/auth/me', $headers)->assertUnauthorized();
});

it('rate limits repeated login attempts', function () {
    User::factory()->create(['email' => 'rl@example.com', 'password' => 'secret123']);

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['email' => 'rl@example.com', 'password' => 'wrong'])
            ->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/login', ['email' => 'rl@example.com', 'password' => 'wrong'])
        ->assertStatus(429);
});
