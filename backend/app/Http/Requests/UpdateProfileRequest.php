<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The vocal range + voice type are CLIENT-DETECTED results from onboarding.
     * The server stores them verbatim and never recomputes them.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:60'],
            'avatar_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'voice_type_key' => ['sometimes', 'nullable', 'string', 'in:bass,baritone,tenor,contralto,mezzo,soprano'],
            'voice_type_label' => ['sometimes', 'nullable', 'string', 'max:64'],
            // MIDI note numbers. E1 (16) .. C8 (108) comfortably covers any human voice.
            'range_low_midi' => ['sometimes', 'nullable', 'integer', 'between:16,108'],
            'range_high_midi' => ['sometimes', 'nullable', 'integer', 'between:16,108', 'gte:range_low_midi'],
            'mark_onboarded' => ['sometimes', 'boolean'],
        ];
    }
}
