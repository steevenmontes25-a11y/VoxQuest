<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use Illuminate\Validation\ValidationException;

final class UnknownExerciseException extends \RuntimeException
{
    public static function for(string $exerciseId): ValidationException
    {
        return ValidationException::withMessages([
            'exercise_id' => ["El ejercicio «{$exerciseId}» no existe en el catalogo."],
        ]);
    }
}
