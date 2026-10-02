<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /** @var list<string> */
    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar_url',
        'voice_type_key',
        'voice_type_label',
        'range_low_midi',
        'range_high_midi',
        'onboarded_at',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'onboarded_at' => 'datetime',
            'password' => 'hashed',
            'range_low_midi' => 'integer',
            'range_high_midi' => 'integer',
            'xp_total' => 'integer',
            'is_admin' => 'boolean',
        ];
    }

    /** @return HasMany<XpEvent, $this> */
    public function xpEvents(): HasMany
    {
        return $this->hasMany(XpEvent::class);
    }

    /** @return HasMany<ExerciseResult, $this> */
    public function exerciseResults(): HasMany
    {
        return $this->hasMany(ExerciseResult::class);
    }

    /** @return HasMany<UnitProgress, $this> */
    public function unitProgress(): HasMany
    {
        return $this->hasMany(UnitProgress::class);
    }

    /** @return HasMany<UserAchievement, $this> */
    public function achievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class);
    }

    /** @return HasOne<Streak, $this> */
    public function streak(): HasOne
    {
        return $this->hasOne(Streak::class);
    }

    /** @return HasMany<VocalRangeSnapshot, $this> */
    public function vocalRangeHistory(): HasMany
    {
        return $this->hasMany(VocalRangeSnapshot::class);
    }

    /** @return HasMany<PitchAccuracySession, $this> */
    public function pitchAccuracySessions(): HasMany
    {
        return $this->hasMany(PitchAccuracySession::class);
    }

    /**
     * Ensure a streak row always exists for this user.
     */
    public function streakRow(): Streak
    {
        return $this->streak()->firstOrCreate([]);
    }
}
