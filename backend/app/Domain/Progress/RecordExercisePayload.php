<?php

declare(strict_types=1);

namespace App\Domain\Progress;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * One "I finished this exercise" event, from live online play or from a sync
 * batch. The server derives XP and stars from `score` + the catalog; `stars`
 * and any `amount` sent by the client are ignored on purpose.
 */
final class RecordExercisePayload
{
    /**
     * @param array<string, float|int> $metrics
     */
    public function __construct(
        public readonly string $exerciseId,
        public readonly float $score,
        public readonly array $metrics = [],
        public readonly ?string $clientGeneratedId = null,
        public readonly ?Carbon $occurredAt = null,
        public readonly ?string $syncBatchId = null,
    ) {}

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            exerciseId: (string) $data['exercise_id'],
            score: (float) $data['score'],
            metrics: self::sanitizeMetrics($data['metrics'] ?? []),
            clientGeneratedId: isset($data['client_generated_id'])
                ? (string) $data['client_generated_id']
                : (string) Str::uuid(),
            occurredAt: isset($data['occurred_at'])
                ? Carbon::parse($data['occurred_at'])
                : Carbon::now(),
            syncBatchId: $data['sync_batch_id'] ?? null,
        );
    }

    public function occurredAtOrNow(): Carbon
    {
        return $this->occurredAt ?? Carbon::now();
    }

    /**
     * Keep only numeric, finite, non-negative metric values and cap them so a
     * tampered client can't unlock metric-based achievements with absurd numbers.
     *
     * @param mixed $metrics
     * @return array<string, float|int>
     */
    private static function sanitizeMetrics(mixed $metrics): array
    {
        if (! is_array($metrics)) {
            return [];
        }

        $clean = [];
        foreach ($metrics as $key => $value) {
            if (! is_string($key) || ! is_numeric($value)) {
                continue;
            }
            $num = (float) $value;
            if (! is_finite($num) || $num < 0) {
                continue;
            }
            // No single practice metric legitimately exceeds this (seconds, note
            // counts, combos...). 3600 = one hour.
            $clean[$key] = min($num, 3600);
        }

        return $clean;
    }
}
