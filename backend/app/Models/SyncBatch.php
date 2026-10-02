<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class SyncBatch extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'device_id',
        'idempotency_key',
        'events_received',
        'events_applied',
        'events_rejected',
        'result',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'events_received' => 'integer',
            'events_applied' => 'integer',
            'events_rejected' => 'integer',
            'result' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
