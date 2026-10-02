<?php

use App\Models\PitchAccuracySession;
use App\Models\User;
use App\Models\VocalRangeSnapshot;
use App\Models\XpEvent;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->seed(\Database\Seeders\AchievementSeeder::class);
    [$this->user, $this->headers] = actingAsUser(['xp_total' => 0]);
});

function syncBatch(array $events, ?string $key = null, string $device = 'chrome'): array
{
    return [
        'idempotency_key' => $key ?? (string) Str::uuid(),
        'device_id' => $device,
        'events' => $events,
    ];
}

it('applies a mixed batch and returns the consolidated state', function () {
    $body = syncBatch([
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-falling-1', 'score' => 0.82, 'metrics' => ['perfectNotes' => 4], 'occurred_at' => '2026-09-07T10:00:00Z'],
        ['type' => 'vocal_range', 'client_generated_id' => (string) Str::uuid(), 'low_midi' => 48, 'high_midi' => 70, 'avg_pitch_error_cents' => 21.5, 'recorded_at' => '2026-09-07T10:05:00Z'],
        ['type' => 'pitch_session', 'client_generated_id' => (string) Str::uuid(), 'module' => 'pitch', 'avg_score' => 0.7, 'avg_error_cents' => 30, 'duration_seconds' => 120, 'occurred_at' => '2026-09-07T10:04:00Z'],
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $res->assertJsonPath('batch.events_received', 3)
        ->assertJsonPath('batch.events_applied', 3)
        ->assertJsonPath('batch.events_rejected', 0)
        ->assertJsonPath('replayed_batch', false)
        ->assertJsonPath('state.results.ex-pitch-falling-1.stars', 2);

    expect((int) $res->json('state.xp_total'))->toBeGreaterThan(0)
        ->and(VocalRangeSnapshot::where('user_id', $this->user->id)->count())->toBe(1)
        ->and(PitchAccuracySession::where('user_id', $this->user->id)->count())->toBe(1)
        ->and($res->json('state.achievements'))->not->toBeEmpty(); // first-note + first-exercise
});

it('is idempotent on the whole batch (same idempotency_key)', function () {
    $key = (string) Str::uuid();
    $events = [
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-echo-1', 'score' => 0.9],
    ];

    $first = $this->postJson('/api/v1/sync', syncBatch($events, $key), $this->headers)->assertOk();
    $xpAfterFirst = (int) $first->json('state.xp_total');

    $second = $this->postJson('/api/v1/sync', syncBatch($events, $key), $this->headers)->assertOk();

    $second->assertJsonPath('replayed_batch', true);
    expect((int) $second->json('state.xp_total'))->toBe($xpAfterFirst)
        ->and(XpEvent::where('user_id', $this->user->id)->count())->toBe(1);
});

it('does not double-credit an event id that appears in two different batches', function () {
    $sharedId = (string) Str::uuid();
    $event = ['type' => 'exercise_result', 'client_generated_id' => $sharedId, 'exercise_id' => 'ex-scale-major', 'score' => 0.8];

    $a = $this->postJson('/api/v1/sync', syncBatch([$event]), $this->headers)->assertOk();
    $xpAfterA = (int) $a->json('state.xp_total');

    // different batch key, same event id -> event is a replay no-op
    $b = $this->postJson('/api/v1/sync', syncBatch([$event, [
        'type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-scale-minor', 'score' => 0.8,
    ]]), $this->headers)->assertOk();

    $b->assertJsonPath('batch.events_applied', 1); // only the new one
    expect(XpEvent::where('user_id', $this->user->id)->count())->toBe(2)
        ->and((int) $b->json('state.xp_total'))->toBeGreaterThan($xpAfterA);
});

it('keeps the best result when the batch has two attempts of one exercise', function () {
    $body = syncBatch([
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-interval-fifth', 'score' => 0.5],
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-interval-fifth', 'score' => 0.95],
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $res->assertJsonPath('state.results.ex-interval-fifth.stars', 3);
    expect(array_column($res->json('state.achievements'), 'id'))->toContain('fifth-master');
});

it('rejects a tampered xp event but still applies the rest of the batch', function () {
    $body = syncBatch([
        ['type' => 'xp', 'client_generated_id' => (string) Str::uuid(), 'source_module' => 'pitch', 'source_exercise_id' => 'ex-pitch-falling-1', 'amount' => 99999],
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-falling-1', 'score' => 0.8],
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $res->assertJsonPath('batch.events_applied', 1)
        ->assertJsonPath('batch.events_rejected', 1);
    expect($res->json('batch.errors.0.errors.amount'))->not->toBeNull();
});

it('accepts an xp event within the per-exercise cap', function () {
    $body = syncBatch([
        ['type' => 'xp', 'client_generated_id' => (string) Str::uuid(), 'source_module' => 'pitch', 'source_exercise_id' => 'ex-pitch-falling-1', 'amount' => 40],
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $res->assertJsonPath('batch.events_applied', 1);
    expect((int) $res->json('state.xp_total'))->toBe(40);
});

it('rejects an unknown exercise inside the batch without failing the batch', function () {
    $body = syncBatch([
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-not-real', 'score' => 0.9],
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-theory-quiz-1', 'score' => 0.9],
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $res->assertJsonPath('batch.events_applied', 1)
        ->assertJsonPath('batch.events_rejected', 1)
        ->assertJsonPath('batch.errors.0.index', 0);
});

it('ignores an achievement claim whose condition is not met, honours one that is', function () {
    $body = syncBatch([
        ['type' => 'achievement_unlock', 'achievement_id' => 'level-10'], // not met
        ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'boss-breath-1', 'score' => 0.8],
        ['type' => 'achievement_unlock', 'achievement_id' => 'boss-1'], // met by the line above
    ]);

    $res = $this->postJson('/api/v1/sync', $body, $this->headers)->assertOk();

    $ids = array_column($res->json('state.achievements'), 'id');
    expect($ids)->toContain('boss-1')
        ->and($ids)->not->toContain('level-10');
});

it('converges when two devices sync overlapping batches', function () {
    $e1 = ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-sustain-1', 'score' => 0.7];
    $e2 = ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-falling-1', 'score' => 0.7];
    $e3 = ['type' => 'exercise_result', 'client_generated_id' => (string) Str::uuid(), 'exercise_id' => 'ex-pitch-echo-1', 'score' => 0.7];

    // device A
    $this->postJson('/api/v1/sync', syncBatch([$e1, $e2], null, 'deviceA'), $this->headers)->assertOk();

    // device B replays e2 and adds e3
    $b = $this->postJson('/api/v1/sync', syncBatch([$e2, $e3], null, 'deviceB'), $this->headers)->assertOk();

    expect(XpEvent::where('user_id', $this->user->id)->count())->toBe(3) // no dupes
        ->and($b->json('state.units.u-pitch-2.status'))->toBe('in_progress'); // cascade fired once all 3 cleared
});

it('422s a batch with no idempotency key', function () {
    $this->postJson('/api/v1/sync', ['events' => []], $this->headers)
        ->assertStatus(422)->assertJsonValidationErrorFor('idempotency_key');
});

it('rate limits sync', function () {
    foreach (range(1, 20) as $i) {
        $this->postJson('/api/v1/sync', syncBatch([]), $this->headers)->assertOk();
    }
    $this->postJson('/api/v1/sync', syncBatch([]), $this->headers)->assertStatus(429);
});
