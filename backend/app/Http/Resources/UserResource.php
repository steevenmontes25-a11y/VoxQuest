<?php

namespace App\Http\Resources;

use App\Domain\Xp\XpCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $level = app(XpCalculator::class)->levelFromXp((int) $this->xp_total);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->email_verified_at !== null,
            'avatar_url' => $this->avatar_url,
            'onboarded' => $this->onboarded_at !== null,
            'voice' => [
                'type_key' => $this->voice_type_key,
                'type_label' => $this->voice_type_label,
                'range_low_midi' => $this->range_low_midi,
                'range_high_midi' => $this->range_high_midi,
            ],
            'xp_total' => (int) $this->xp_total,
            'level' => $level['level'],
            'level_progress' => $level['progress'],
            'registered_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
