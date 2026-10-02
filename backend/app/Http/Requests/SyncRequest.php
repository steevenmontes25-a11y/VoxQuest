<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Structural validation only. Per-event business rules (unknown exercise id,
 * XP over the cap, ...) are enforced by SyncBatchProcessor, which rejects the
 * offending event and keeps applying the rest.
 */
class SyncRequest extends FormRequest
{
    public const EVENT_TYPES = [
        'exercise_result',
        'xp',
        'vocal_range',
        'pitch_session',
        'achievement_unlock',
    ];

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'idempotency_key' => ['required', 'string', 'max:64'],
            'device_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'events' => ['present', 'array', 'max:500'],
            'events.*.type' => ['required', Rule::in(self::EVENT_TYPES)],
            'events.*.client_generated_id' => ['nullable', 'uuid'],
            'events.*.occurred_at' => ['sometimes', 'date'],
            'events.*.recorded_at' => ['sometimes', 'date'],

            // loose per-type hints; the processor does the real checks
            'events.*.exercise_id' => ['sometimes', 'string', 'max:64'],
            'events.*.score' => ['sometimes', 'numeric'],
            'events.*.metrics' => ['sometimes', 'array'],
            'events.*.amount' => ['sometimes', 'integer', 'min:0'],
            'events.*.source_module' => ['sometimes', 'string', 'max:32'],
            'events.*.low_midi' => ['sometimes', 'integer'],
            'events.*.high_midi' => ['sometimes', 'integer'],
            'events.*.module' => ['sometimes', 'string', 'max:32'],
            'events.*.avg_score' => ['sometimes', 'numeric'],
            'events.*.avg_error_cents' => ['sometimes', 'numeric'],
            'events.*.duration_seconds' => ['sometimes', 'integer'],
            'events.*.achievement_id' => ['sometimes', 'string', 'max:64'],
        ];
    }
}
