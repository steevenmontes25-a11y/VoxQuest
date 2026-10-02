<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<XpEvent>
 */
class XpEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $exercises = array_keys(config('voxquest.exercises'));
        $exerciseId = fake()->randomElement($exercises);
        $meta = config("voxquest.exercises.$exerciseId");

        return [
            'user_id' => User::factory(),
            'amount' => fake()->numberBetween(20, 150),
            'source_module' => $meta['module'],
            'source_exercise_id' => $exerciseId,
            'stars' => fake()->numberBetween(0, 3),
            'score' => fake()->randomFloat(3, 0, 1),
            'first_clear' => fake()->boolean(20),
            'client_generated_id' => (string) Str::uuid(),
            'sync_batch_id' => null,
            'occurred_at' => now(),
            'created_at' => now(),
        ];
    }
}
