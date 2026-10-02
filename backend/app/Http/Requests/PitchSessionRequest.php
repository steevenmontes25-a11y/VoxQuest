<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PitchSessionRequest extends FormRequest
{
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
            'module' => ['required', 'string', Rule::in(config('voxquest.modules'))],
            'exercise_id' => ['sometimes', 'nullable', 'string', Rule::in(array_keys(config('voxquest.exercises')))],
            'avg_score' => ['required', 'numeric', 'between:0,1'],
            'avg_error_cents' => ['required', 'numeric', 'between:0,1200'],
            'duration_seconds' => ['required', 'integer', 'between:1,7200'],
            'notes_total' => ['sometimes', 'nullable', 'integer', 'between:0,100000'],
            'notes_in_tune' => ['sometimes', 'nullable', 'integer', 'between:0,100000', 'lte:notes_total'],
            'client_generated_id' => ['sometimes', 'uuid'],
            'occurred_at' => ['sometimes', 'date'],
        ];
    }
}
