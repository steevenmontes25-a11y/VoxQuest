<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class ExerciseResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'exercise_id',
        'unit_id',
        'module',
        'stars',
        'best_score',
        'attempts',
        'metrics',
        'last_played_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'stars' => 'integer',
            'best_score' => 'float',
            'attempts' => 'integer',
            'metrics' => 'array',
            'last_played_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
