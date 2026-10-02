<?php

namespace Database\Factories;

use App\Models\ExerciseResult;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ExerciseResult>
 */
class ExerciseResultFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $exercises = array_keys(config('voxquest.exercises'));
        $exerciseId = fake()->randomElement($exercises);
        $meta = config("voxquest.exercises.$exerciseId");
        $stars = fake()->numberBetween(0, 3);

        return [
            'user_id' => User::factory(),
            'exercise_id' => $exerciseId,
            'unit_id' => $meta['unit'],
            'module' => $meta['module'],
            'stars' => $stars,
            'best_score' => match ($stars) {
                3 => fake()->randomFloat(3, 0.90, 1.0),
                2 => fake()->randomFloat(3, 0.75, 0.899),
                1 => fake()->randomFloat(3, 0.55, 0.749),
                default => fake()->randomFloat(3, 0.0, 0.549),
            },
            'attempts' => fake()->numberBetween(1, 6),
            'metrics' => ['perfectNotes' => fake()->numberBetween(0, 8)],
            'last_played_at' => now(),
        ];
    }

    public function forExercise(string $exerciseId): static
    {
        $meta = config("voxquest.exercises.$exerciseId");

        return $this->state(fn () => [
            'exercise_id' => $exerciseId,
            'unit_id' => $meta['unit'],
            'module' => $meta['module'],
        ]);
    }

    public function stars(int $stars): static
    {
        return $this->state(fn () => ['stars' => $stars]);
    }
}
