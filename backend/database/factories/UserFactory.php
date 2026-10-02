<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'avatar_url' => null,
            'voice_type_key' => fake()->randomElement(['bass', 'baritone', 'tenor', 'contralto', 'mezzo', 'soprano']),
            'voice_type_label' => fn (array $attrs) => ucfirst((string) ($attrs['voice_type_key'] ?? 'tenor')),
            'range_low_midi' => 48,
            'range_high_midi' => 72,
            'onboarded_at' => now(),
            'xp_total' => 0,
            'is_admin' => false,
        ];
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => ['is_admin' => true]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function notOnboarded(): static
    {
        return $this->state(fn (array $attributes) => [
            'onboarded_at' => null,
            'voice_type_key' => null,
            'voice_type_label' => null,
            'range_low_midi' => null,
            'range_high_midi' => null,
        ]);
    }
}
