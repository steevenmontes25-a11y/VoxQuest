<?php

use App\Domain\Xp\XpCalculator;

beforeEach(function () {
    $this->xp = new XpCalculator();
});

it('starts everyone at level 1 with 0 xp', function () {
    expect($this->xp->levelFromXp(0))->toMatchArray(['level' => 1, 'into_level' => 0]);
});

it('matches the frontend xpForExercise formula', function () {
    // 40 * (0.5 + 0.5*0.4) * (1 + 0) * 1  = 40 * 0.7 = 28
    expect($this->xp->xpForExercise(40, 0, 0.4, false))->toBe(28);

    // 60 * (0.5 + 0.5*1) * (1 + 2*0.15) * 1 = 60 * 1 * 1.3 = 78
    expect($this->xp->xpForExercise(60, 2, 1.0, false))->toBe(78);

    // 140 * 1 * (1 + 3*0.15) * 1.5 = 140 * 1.45 * 1.5 = 304.5 -> 305
    expect($this->xp->xpForExercise(140, 3, 1.0, true))->toBe(305);
});

it('maps score to stars on the frontend thresholds', function () {
    expect($this->xp->starsFromScore(0.95))->toBe(3)
        ->and($this->xp->starsFromScore(0.90))->toBe(3)
        ->and($this->xp->starsFromScore(0.80))->toBe(2)
        ->and($this->xp->starsFromScore(0.60))->toBe(1)
        ->and($this->xp->starsFromScore(0.30))->toBe(0);
});

it('gives a first-clear bonus', function () {
    $first = $this->xp->xpForExercise(55, 2, 0.8, true);
    $repeat = $this->xp->xpForExercise(55, 2, 0.8, false);

    // 55 * (0.5 + 0.5*0.8=0.9) * (1 + 2*0.15=1.3) = 64.35        -> repeat = round(64.35) = 64
    // 64.35 * 1.5 = 96.525                                        -> first  = round(96.525) = 97
    expect($repeat)->toBe(64)
        ->and($first)->toBe(97)
        ->and($first)->toBeGreaterThan($repeat);
});

it('level rises monotonically with xp and is consistent with xpForLevel', function () {
    $prev = 1;
    for ($xp = 0; $xp < 8000; $xp += 173) {
        $lvl = $this->xp->levelForXp($xp);
        expect($lvl)->toBeGreaterThanOrEqual($prev);
        $prev = $lvl;
    }

    for ($l = 1; $l <= 12; $l++) {
        expect($this->xp->levelForXp($this->xp->xpForLevel($l)))->toBe($l);
    }
});

it('caps the per-exercise xp for anti-cheat', function () {
    // boss-pitch-1 base 140 -> best possible 305, under the 320 hard cap
    expect($this->xp->maxXpForExercise('boss-pitch-1'))->toBe(305);

    // a 35-xp theory exercise: 35 * 1.45 * 1.5 = 76.125 -> 76
    expect($this->xp->maxXpForExercise('ex-theory-quiz-1'))->toBe(76);

    // unknown exercise -> 0
    expect($this->xp->maxXpForExercise('ex-nope'))->toBe(0);
});
