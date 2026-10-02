<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VocalRangeRequest extends FormRequest
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
            'low_midi' => ['required', 'integer', 'between:16,108'],
            'high_midi' => ['required', 'integer', 'between:16,108', 'gte:low_midi'],
            'avg_pitch_error_cents' => ['sometimes', 'nullable', 'numeric', 'between:0,1200'],
            'client_generated_id' => ['sometimes', 'uuid'],
            'recorded_at' => ['sometimes', 'date'],
            'apply_to_profile' => ['sometimes', 'boolean'],
        ];
    }
}
