<?php

declare(strict_types=1);

namespace App\Domain\Xp;

/**
 * Server-side mirror of src/game/xp.ts. This is authoritative: the API never
 * trusts a client-supplied XP amount, it recomputes it here from the exercise
 * catalog in config/voxquest.php.
 *
 * Rounding matches JavaScript's Math.round (round half toward +Infinity) via
 * floor(x + 0.5), so a given (baseXp, stars, score) yields the identical amount
 * on both sides.
 */
class XpCalculator
{
    /** @var array{coef: float, exp: float, flat: float} */
    private array $curve;

    private float $perfFloor;

    private float $perfSpan;

    private float $starBonusStep;

    private float $firstClearBonus;

    private int $hardEventCap;

    /** @var array<int, float> */
    private array $starThresholds;

    public function __construct()
    {
        $cfg = config('voxquest.xp');
        $this->curve = [
            'coef' => (float) $cfg['level_curve']['coef'],
            'exp' => (float) $cfg['level_curve']['exp'],
            'flat' => (float) $cfg['level_curve']['flat'],
        ];
        $this->perfFloor = (float) $cfg['perf_floor'];
        $this->perfSpan = (float) $cfg['perf_span'];
        $this->starBonusStep = (float) $cfg['star_bonus_step'];
        $this->firstClearBonus = (float) $cfg['first_clear_bonus'];
        $this->hardEventCap = (int) $cfg['hard_event_cap'];
        $this->starThresholds = config('voxquest.star_thresholds');
    }

    public static function jsRound(float $x): int
    {
        return (int) floor($x + 0.5);
    }

    /** XP needed to go from $level to $level + 1. */
    public function levelCurveNext(int $level): int
    {
        return self::jsRound($this->curve['coef'] * ($level ** $this->curve['exp']) + $this->curve['flat']);
    }

    /** Cumulative XP required to reach $level (level 1 == 0). */
    public function xpForLevel(int $level): int
    {
        $total = 0;
        for ($l = 1; $l < $level; $l++) {
            $total += $this->levelCurveNext($l);
        }

        return $total;
    }

    /**
     * @return array{level: int, into_level: int, span: int, progress: float}
     */
    public function levelFromXp(int $totalXp): array
    {
        $level = 1;
        $acc = 0;
        while ($acc + $this->levelCurveNext($level) <= $totalXp) {
            $acc += $this->levelCurveNext($level);
            $level++;
        }
        $span = $this->levelCurveNext($level);
        $into = $totalXp - $acc;

        return [
            'level' => $level,
            'into_level' => $into,
            'span' => $span,
            'progress' => $span > 0 ? round($into / $span, 4) : 0.0,
        ];
    }

    public function levelForXp(int $totalXp): int
    {
        return $this->levelFromXp($totalXp)['level'];
    }

    /**
     * XP awarded for one exercise result.
     *
     * perf      = perfFloor + perfSpan * score       (score clamped 0..1)
     * starBonus = 1 + starBonusStep * stars          (stars clamped 0..3)
     * firstBonus= firstClearBonus on the first ever clear, else 1
     */
    public function xpForExercise(int $baseXp, int $stars, float $score, bool $firstClear): int
    {
        $score = max(0.0, min(1.0, $score));
        $stars = max(0, min(3, $stars));

        $perf = $this->perfFloor + $this->perfSpan * $score;
        $starBonus = 1 + $this->starBonusStep * $stars;
        $first = $firstClear ? $this->firstClearBonus : 1.0;

        return self::jsRound($baseXp * $perf * $starBonus * $first);
    }

    public function starsFromScore(float $score): int
    {
        foreach ($this->starThresholds as $stars => $threshold) {
            if ($score >= $threshold) {
                return (int) $stars;
            }
        }

        return 0;
    }

    /**
     * Absolute ceiling for a single xp_event for the given exercise:
     * the most XP obtainable (3 stars, perfect score, first clear), clamped
     * to the global hard cap. Anything above this in a payload is a tampered
     * client and the event is rejected.
     */
    public function maxXpForExercise(string $exerciseId): int
    {
        $baseXp = (int) (config("voxquest.exercises.$exerciseId.base_xp") ?? 0);

        if ($baseXp <= 0) {
            return 0;
        }

        return min($this->hardEventCap, $this->xpForExercise($baseXp, 3, 1.0, true));
    }

    public function hardEventCap(): int
    {
        return $this->hardEventCap;
    }
}
