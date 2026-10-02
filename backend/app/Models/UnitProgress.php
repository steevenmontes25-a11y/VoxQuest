<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class UnitProgress extends Model
{
    protected $table = 'unit_progress';

    protected $fillable = [
        'user_id',
        'unit_id',
        'module',
        'status',
        'stars_earned',
        'stars_possible',
        'exercises_cleared',
        'best_score',
        'unlocked_at',
        'completed_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'stars_earned' => 'integer',
            'stars_possible' => 'integer',
            'exercises_cleared' => 'integer',
            'best_score' => 'float',
            'unlocked_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
