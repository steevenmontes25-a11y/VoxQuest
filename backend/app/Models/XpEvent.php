<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class XpEvent extends Model
{
    use HasFactory;

    /** Append-only: no updated_at. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'amount',
        'source_module',
        'source_exercise_id',
        'stars',
        'score',
        'first_clear',
        'client_generated_id',
        'sync_batch_id',
        'occurred_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'stars' => 'integer',
            'score' => 'float',
            'first_clear' => 'boolean',
            'occurred_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
