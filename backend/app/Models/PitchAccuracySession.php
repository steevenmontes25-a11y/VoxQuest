<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PitchAccuracySession extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'module',
        'exercise_id',
        'avg_score',
        'avg_error_cents',
        'duration_seconds',
        'notes_total',
        'notes_in_tune',
        'client_generated_id',
        'occurred_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'avg_score' => 'float',
            'avg_error_cents' => 'float',
            'duration_seconds' => 'integer',
            'notes_total' => 'integer',
            'notes_in_tune' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
