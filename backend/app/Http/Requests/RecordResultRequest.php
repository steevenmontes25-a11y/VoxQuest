<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RecordResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * `stars` and any `amount`/`xp` are intentionally NOT accepted: the server
     * derives them from `score` against the exercise catalog.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'score' => ['required', 'numeric', 'between:0,1'],
            'metrics' => ['sometimes', 'array'],
            'metrics.*' => ['numeric'],
            'client_generated_id' => ['sometimes', 'uuid'],
            'occurred_at' => ['sometimes', 'date'],
        ];
    }
}
