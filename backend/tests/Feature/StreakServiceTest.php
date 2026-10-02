<?php

use App\Domain\Streaks\StreakService;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->service = app(StreakService::class);
    $this->user = User::factory()->create();
});

it('starts a streak at 1 on the first touch', function () {
    $streak = $this->service->touch($this->user, Carbon::parse('2026-09-08'));

    expect($streak->current_count)->toBe(1)
        ->and($streak->longest_count)->toBe(1)
        ->and($streak->last_activity_date->toDateString())->toBe('2026-09-08');
});

it('does not double-count the same day', function () {
    $this->service->touch($this->user, Carbon::parse('2026-09-08 08:00'));
    $streak = $this->service->touch($this->user, Carbon::parse('2026-09-08 21:00'));

    expect($streak->current_count)->toBe(1);
});

it('increments on a consecutive day and tracks the longest', function () {
    $this->service->touch($this->user, Carbon::parse('2026-09-08'));
    $this->service->touch($this->user, Carbon::parse('2026-09-09'));
    $streak = $this->service->touch($this->user, Carbon::parse('2026-09-10'));

    expect($streak->current_count)->toBe(3)
        ->and($streak->longest_count)->toBe(3);

    // break it, then the longest is preserved
    $broken = $this->service->touch($this->user, Carbon::parse('2026-09-20'));
    expect($broken->current_count)->toBe(1)
        ->and($broken->longest_count)->toBe(3);
});

it('forgives a single missed day once (grace), then resets on the next gap', function () {
    config(['voxquest.streak.grace_days' => 1]);

    $this->service->touch($this->user, Carbon::parse('2026-09-08')); // 1
    $this->service->touch($this->user, Carbon::parse('2026-09-09')); // 2
    // miss the 10th, come back on the 11th -> grace spent, keeps counting
    $g = $this->service->touch($this->user, Carbon::parse('2026-09-11'));
    expect($g->current_count)->toBe(3)
        ->and($g->grace_used_on->toDateString())->toBe('2026-09-11');

    // miss the 12th, come back on the 13th -> grace still on cooldown -> reset
    $r = $this->service->touch($this->user, Carbon::parse('2026-09-13'));
    expect($r->current_count)->toBe(1);
});

it('resets when grace is disabled and a day is missed', function () {
    config(['voxquest.streak.grace_days' => 0]);

    $this->service->touch($this->user, Carbon::parse('2026-09-08'));
    $streak = $this->service->touch($this->user, Carbon::parse('2026-09-10')); // gap of 2

    expect($streak->current_count)->toBe(1);
});

it('ignores an out-of-order older event', function () {
    $this->service->touch($this->user, Carbon::parse('2026-09-10'));
    $streak = $this->service->touch($this->user, Carbon::parse('2026-09-05'));

    expect($streak->current_count)->toBe(1)
        ->and($streak->last_activity_date->toDateString())->toBe('2026-09-10');
});
