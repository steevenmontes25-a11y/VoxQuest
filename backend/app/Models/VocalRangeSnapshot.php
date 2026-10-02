<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class VocalRangeSnapshot extends Model
{
    protected $table = 'vocal_range_history';

    protected $fillable = [
        'user_id',
        'low_midi',
        'high_midi',
        'avg_pitch_error_cents',
        'client_generated_id',
        'recorded_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'low_midi' => 'integer',
            'high_midi' => 'integer',
            'avg_pitch_error_cents' => 'float',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
