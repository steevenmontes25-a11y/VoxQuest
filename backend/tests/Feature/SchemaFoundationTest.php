<?php

use App\Models\Achievement;
use App\Models\ExerciseResult;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('runs every VoxQuest table on postgres', function () {
    expect(Schema::hasTable('xp_events'))->toBeTrue()
        ->and(Schema::hasTable('achievements'))->toBeTrue()
        ->and(Schema::hasTable('user_achievements'))->toBeTrue()
        ->and(Schema::hasTable('streaks'))->toBeTrue()
        ->and(Schema::hasTable('exercise_results'))->toBeTrue()
        ->and(Schema::hasTable('unit_progress'))->toBeTrue()
        ->and(Schema::hasTable('vocal_range_history'))->toBeTrue()
        ->and(Schema::hasTable('pitch_accuracy_sessions'))->toBeTrue()
        ->and(Schema::hasTable('sync_batches'))->toBeTrue();

    expect(DB::connection()->getDriverName())->toBe('pgsql');
});

it('adds the VoxQuest profile columns to users', function () {
    foreach (['avatar_url', 'voice_type_key', 'voice_type_label', 'range_low_midi', 'range_high_midi', 'onboarded_at', 'xp_total'] as $col) {
        expect(Schema::hasColumn('users', $col))->toBeTrue("users.$col missing");
    }
});

it('seeds the 12-achievement catalog from config', function () {
    $this->seed(\Database\Seeders\AchievementSeeder::class);

    expect(Achievement::count())->toBe(12);
    expect(Achievement::find('fifth-master')->rule)
        ->toBe(['type' => 'exercise_stars_at_least', 'exercise' => 'ex-interval-fifth', 'value' => 3]);
});

it('keeps the exercise catalog and unit list consistent', function () {
    $units = array_keys(config('voxquest.units'));

    foreach (config('voxquest.exercises') as $id => $meta) {
        expect($meta['unit'])->toBeIn($units, "exercise $id points at unknown unit {$meta['unit']}");
        expect($meta['module'])->toBeIn(config('voxquest.modules'));
        expect($meta['base_xp'])->toBeGreaterThan(0);
    }

    foreach (config('voxquest.units') as $unitId => $u) {
        if ($u['requires'] !== null) {
            expect($u['requires'])->toBeIn($units, "unit $unitId requires unknown {$u['requires']}");
        }
    }
});

it('enforces the xp_events idempotency key per user', function () {
    $user = User::factory()->create();
    $uuid = (string) Str::uuid();

    XpEvent::factory()->for($user)->create(['client_generated_id' => $uuid]);

    expect(fn () => XpEvent::factory()->for($user)->create(['client_generated_id' => $uuid]))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

it('enforces one exercise_results row per (user, exercise)', function () {
    $user = User::factory()->create();

    ExerciseResult::factory()->for($user)->forExercise('ex-pitch-falling-1')->create();

    expect(fn () => ExerciseResult::factory()->for($user)->forExercise('ex-pitch-falling-1')->create())
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
