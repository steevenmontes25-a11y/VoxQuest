<?php

declare(strict_types=1);

namespace App\Domain\Progress;

final class RecordExerciseOutcome
{
    /**
     * @param list<string> $newAchievements
     */
    public function __construct(
        public readonly bool $applied,          // false when the event was a replay
        public readonly int $xpGained,
        public readonly int $stars,
        public readonly bool $firstClear,
        public readonly bool $leveledUp,
        public readonly int $levelBefore,
        public readonly int $levelAfter,
        public readonly array $newAchievements,
    ) {}

    public static function replay(): self
    {
        return new self(false, 0, 0, false, false, 0, 0, []);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'applied' => $this->applied,
            'xp_gained' => $this->xpGained,
            'stars' => $this->stars,
            'first_clear' => $this->firstClear,
            'leveled_up' => $this->leveledUp,
            'level_before' => $this->levelBefore,
            'level_after' => $this->levelAfter,
            'new_achievements' => $this->newAchievements,
        ];
    }
}
