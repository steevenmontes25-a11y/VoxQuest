<?php

declare(strict_types=1);

namespace App\Domain\Sync;

use App\Domain\Achievements\AchievementEvaluator;
use App\Domain\Progress\ConsolidatedStateBuilder;
use App\Domain\Progress\RecordExercisePayload;
use App\Domain\Progress\RecordExerciseResult;
use App\Domain\Xp\XpCalculator;
use App\Models\Achievement;
use App\Models\PitchAccuracySession;
use App\Models\SyncBatch;
use App\Models\User;
use App\Models\VocalRangeSnapshot;
use App\Models\XpEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Offline-first sync. The frontend queues events in IndexedDB while offline (or
 * logged out) and flushes them here as one batch.
 *
 * Idempotency has two layers:
 *   - whole batch: sync_batches unique (user, idempotency_key). A retried batch
 *     returns the stored consolidated state, nothing is re-applied.
 *   - single event: every event carries a client_generated_id, unique per user.
 *     Replaying one event (e.g. it was already synced from another device)
 *     is a no-op.
 *
 * Conflict resolution:
 *   - xp                : additive. Deduped by client_generated_id, xp_total is
 *                         re-summed from the ledger.
 *   - exercise_result   : "best wins" (handled inside RecordExerciseResult).
 *   - unit_progress     : recomputed from exercise_results.
 *   - achievements      : monotonic union of client claims + server re-derivation.
 *   - streak            : StreakService is monotonic and ignores older days, so
 *                         two devices converge on the most advanced coherent value.
 */
class SyncBatchProcessor
{
    public function __construct(
        private readonly RecordExerciseResult $recordExercise,
        private readonly AchievementEvaluator $achievements,
        private readonly ConsolidatedStateBuilder $stateBuilder,
        private readonly XpCalculator $xp,
    ) {}

    /**
     * @param array{idempotency_key: string, device_id?: string|null, events: list<array<string,mixed>>} $input
     * @return array<string, mixed>
     */
    public function process(User $user, array $input): array
    {
        $existing = SyncBatch::query()
            ->where('user_id', $user->id)
            ->where('idempotency_key', $input['idempotency_key'])
            ->first();

        if ($existing !== null) {
            return $existing->result + ['replayed_batch' => true];
        }

        return DB::transaction(function () use ($user, $input): array {
            $batchId = (string) Str::uuid();
            $events = $input['events'];

            $applied = 0;
            $rejected = 0;
            $errors = [];

            foreach ($events as $index => $event) {
                try {
                    $didApply = $this->applyEvent($user, $event, $batchId);
                    $applied += $didApply ? 1 : 0;
                } catch (ValidationException $e) {
                    $rejected++;
                    $errors[] = ['index' => $index, 'type' => $event['type'] ?? null, 'errors' => $e->errors()];
                } catch (\InvalidArgumentException $e) {
                    $rejected++;
                    $errors[] = ['index' => $index, 'type' => $event['type'] ?? null, 'errors' => ['event' => [$e->getMessage()]]];
                }
            }

            // Server re-derivation: keep xp_total exact and union achievements
            // the client did not claim (or claimed wrongly).
            $user->refresh();
            $user->xp_total = (int) XpEvent::where('user_id', $user->id)->sum('amount');
            $user->save();
            $serverEarned = $this->achievements->evaluateAndUnlock($user->fresh());

            $state = $this->stateBuilder->build($user->fresh());

            $result = [
                'batch' => [
                    'id' => $batchId,
                    'events_received' => count($events),
                    'events_applied' => $applied,
                    'events_rejected' => $rejected,
                    'server_unlocked_achievements' => $serverEarned,
                    'errors' => $errors,
                ],
                'state' => $state,
            ];

            SyncBatch::query()->create([
                'id' => $batchId,
                'user_id' => $user->id,
                'device_id' => $input['device_id'] ?? null,
                'idempotency_key' => $input['idempotency_key'],
                'events_received' => count($events),
                'events_applied' => $applied,
                'events_rejected' => $rejected,
                'result' => $result,
            ]);

            return $result + ['replayed_batch' => false];
        });
    }

    /**
     * @param array<string, mixed> $event
     * @return bool  true if the event changed state, false if it was a replay/no-op
     */
    private function applyEvent(User $user, array $event, string $batchId): bool
    {
        return match ($event['type']) {
            'exercise_result' => $this->applyExerciseResult($user, $event, $batchId),
            'xp' => $this->applyXp($user, $event, $batchId),
            'vocal_range' => $this->applyVocalRange($user, $event),
            'pitch_session' => $this->applyPitchSession($user, $event),
            'achievement_unlock' => $this->applyAchievementClaim($user, $event),
            default => throw new \InvalidArgumentException("Tipo de evento desconocido: {$event['type']}"),
        };
    }

    /**
     * @param array<string, mixed> $event
     */
    private function applyExerciseResult(User $user, array $event, string $batchId): bool
    {
        $payload = RecordExercisePayload::fromArray([
            'exercise_id' => $event['exercise_id'] ?? '',
            'score' => $event['score'] ?? 0,
            'metrics' => $event['metrics'] ?? [],
            'client_generated_id' => $event['client_generated_id'] ?? null,
            'occurred_at' => $event['occurred_at'] ?? null,
            'sync_batch_id' => $batchId,
        ]);

        return $this->recordExercise->handle($user, $payload)->applied;
    }

    /**
     * Explicit XP event (legacy / client-computed path). Additive + idempotent +
     * capped against the catalog so a tampered client cannot inflate it.
     *
     * @param array<string, mixed> $event
     */
    private function applyXp(User $user, array $event, string $batchId): bool
    {
        $cgid = $event['client_generated_id'] ?? (string) Str::uuid();

        $dup = XpEvent::where('user_id', $user->id)->where('client_generated_id', $cgid)->exists();
        if ($dup) {
            return false;
        }

        $exerciseId = $event['source_exercise_id'] ?? null;
        $module = $event['source_module'] ?? 'system';
        $amount = (int) ($event['amount'] ?? 0);

        $cap = $exerciseId !== null && config("voxquest.exercises.$exerciseId") !== null
            ? $this->xp->maxXpForExercise($exerciseId)
            : $this->xp->hardEventCap();

        if ($amount < 0) {
            throw ValidationException::withMessages(['amount' => ['La XP no puede ser negativa.']]);
        }
        if ($amount > $cap) {
            throw ValidationException::withMessages([
                'amount' => ["XP {$amount} excede el maximo permitido ({$cap}) para este evento."],
            ]);
        }

        XpEvent::create([
            'user_id' => $user->id,
            'amount' => $amount,
            'source_module' => $module,
            'source_exercise_id' => $exerciseId,
            'stars' => $event['stars'] ?? null,
            'score' => $event['score'] ?? null,
            'first_clear' => (bool) ($event['first_clear'] ?? false),
            'client_generated_id' => $cgid,
            'sync_batch_id' => $batchId,
            'occurred_at' => isset($event['occurred_at']) ? Carbon::parse($event['occurred_at']) : Carbon::now(),
        ]);

        $user->increment('xp_total', $amount);

        return true;
    }

    /**
     * @param array<string, mixed> $event
     */
    private function applyVocalRange(User $user, array $event): bool
    {
        $cgid = $event['client_generated_id'] ?? (string) Str::uuid();

        $snapshot = VocalRangeSnapshot::firstOrCreate(
            ['user_id' => $user->id, 'client_generated_id' => $cgid],
            [
                'low_midi' => (int) ($event['low_midi'] ?? 0),
                'high_midi' => (int) ($event['high_midi'] ?? 0),
                'avg_pitch_error_cents' => $event['avg_pitch_error_cents'] ?? null,
                'recorded_at' => isset($event['recorded_at']) ? Carbon::parse($event['recorded_at']) : Carbon::now(),
            ],
        );

        return $snapshot->wasRecentlyCreated;
    }

    /**
     * @param array<string, mixed> $event
     */
    private function applyPitchSession(User $user, array $event): bool
    {
        $cgid = $event['client_generated_id'] ?? (string) Str::uuid();

        $session = PitchAccuracySession::firstOrCreate(
            ['user_id' => $user->id, 'client_generated_id' => $cgid],
            [
                'module' => $event['module'] ?? 'system',
                'exercise_id' => $event['exercise_id'] ?? null,
                'avg_score' => (float) ($event['avg_score'] ?? 0),
                'avg_error_cents' => (float) ($event['avg_error_cents'] ?? 0),
                'duration_seconds' => (int) ($event['duration_seconds'] ?? 0),
                'notes_total' => $event['notes_total'] ?? null,
                'notes_in_tune' => $event['notes_in_tune'] ?? null,
                'occurred_at' => isset($event['occurred_at']) ? Carbon::parse($event['occurred_at']) : Carbon::now(),
            ],
        );

        return $session->wasRecentlyCreated;
    }

    /**
     * Advisory client claim. Server also re-derives achievements at the end, so
     * a wrong/malicious claim for an unmet achievement is harmless — this only
     * fast-tracks legitimately-earned ones and preserves the client's timestamp.
     *
     * @param array<string, mixed> $event
     */
    private function applyAchievementClaim(User $user, array $event): bool
    {
        $id = $event['achievement_id'] ?? null;
        if ($id === null || Achievement::query()->whereKey($id)->doesntExist()) {
            return false;
        }

        if ($user->achievements()->where('achievement_id', $id)->exists()) {
            return false;
        }

        // Only honour the claim if the underlying condition is actually met.
        $serverEarned = $this->achievements->evaluateAndUnlock($user->fresh());

        return in_array($id, $serverEarned, true);
    }
}
