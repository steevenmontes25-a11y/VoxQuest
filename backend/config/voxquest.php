<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| VoxQuest domain configuration
|--------------------------------------------------------------------------
|
| This file is the SERVER-SIDE SOURCE OF TRUTH for game rules. It mirrors the
| frontend (src/game/xp.ts, src/game/achievements.ts, src/data/curriculum.ts).
| The client is never trusted for XP amounts, stars or unlock state: every
| write is recomputed here from the exercise catalog below.
|
| Keep this in sync with the frontend curriculum whenever units/exercises
| change. `php artisan voxquest:catalog-check` (see console kernel) diffs the
| seeded achievements against this file.
|
*/

return [

    /*
    | Origins (PWA) allowed to call the API. Comma-separated in the env.
    */
    'frontend_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('VOXQUEST_FRONTEND_ORIGINS', 'http://localhost:5173'))
    ))),

    'require_email_verification' => (bool) env('VOXQUEST_REQUIRE_EMAIL_VERIFICATION', false),

    /*
    |--------------------------------------------------------------------------
    | XP curve (mirror of src/game/xp.ts)
    |--------------------------------------------------------------------------
    | xpToNext(level)      = round(coef * level^exp + flat)
    | xpForExercise(...)   = round(baseXp * perf * starBonus * firstBonus)
    |   perf      = perf_floor + perf_span * score          (score in 0..1)
    |   starBonus = 1 + star_bonus_step * stars             (stars in 0..3)
    |   firstBonus= first_clear_bonus on the first ever clear, else 1
    */
    'xp' => [
        'level_curve' => ['coef' => 80, 'exp' => 1.35, 'flat' => 60],
        'perf_floor' => 0.5,
        'perf_span' => 0.5,
        'star_bonus_step' => 0.15,
        'first_clear_bonus' => 1.5,
        // Absolute ceiling for any single xp_event, regardless of catalog.
        // Derived: max baseXp (140) * 1.0 * 1.45 * 1.5 = 304.5 -> 305, padded.
        'hard_event_cap' => 320,
    ],

    /*
    | starsFromScore(score) thresholds (mirror of src/game/xp.ts).
    */
    'star_thresholds' => [
        3 => 0.90,
        2 => 0.75,
        1 => 0.55,
    ],

    /*
    | Difficulty -> pitch tolerance in cents (mirror of src/game/types.ts).
    */
    'difficulty_tolerance_cents' => [
        'beginner' => 50,
        'intermediate' => 25,
        'advanced' => 10,
    ],

    /*
    |--------------------------------------------------------------------------
    | Streaks
    |--------------------------------------------------------------------------
    */
    'streak' => [
        // How many missed days are forgiven before the streak resets to 1.
        'grace_days' => (int) env('VOXQUEST_STREAK_GRACE_DAYS', 1),
    ],

    /*
    |--------------------------------------------------------------------------
    | Modules
    |--------------------------------------------------------------------------
    */
    'modules' => ['breath', 'pitch', 'theory', 'technique', 'repertoire', 'system'],

    /*
    |--------------------------------------------------------------------------
    | Units (mirror of src/data/curriculum.ts). `requires` drives unlocking:
    | a unit unlocks once every exercise of its prerequisite has >= 1 star.
    |--------------------------------------------------------------------------
    */
    'units' => [
        'u-breath-1' => ['module' => 'breath', 'requires' => null],
        'u-breath-2' => ['module' => 'breath', 'requires' => 'u-breath-1'],
        'u-pitch-1' => ['module' => 'pitch', 'requires' => null],
        'u-pitch-2' => ['module' => 'pitch', 'requires' => 'u-pitch-1'],
        'u-pitch-3' => ['module' => 'pitch', 'requires' => 'u-pitch-2'],
        'u-theory-1' => ['module' => 'theory', 'requires' => null],
        'u-theory-2' => ['module' => 'theory', 'requires' => 'u-theory-1'],
        'u-tech-1' => ['module' => 'technique', 'requires' => 'u-pitch-1'],
        'u-rep-1' => ['module' => 'repertoire', 'requires' => 'u-pitch-2'],
    ],

    /*
    | Units a brand-new account starts with unlocked
    | (mirror of defaultState().unlockedUnits).
    */
    'initial_unlocked_units' => ['u-breath-1', 'u-pitch-1', 'u-theory-1'],

    /*
    |--------------------------------------------------------------------------
    | Exercise catalog (mirror of src/data/curriculum.ts)
    |--------------------------------------------------------------------------
    | id => [unit, module, kind, base_xp]
    | `base_xp` is the ONLY input the server trusts for XP; the client cannot
    | inflate it.
    |--------------------------------------------------------------------------
    */
    'exercises' => [
        // u-breath-1
        'ex-breath-478' => ['unit' => 'u-breath-1', 'module' => 'breath', 'kind' => 'breath-pattern', 'base_xp' => 40],
        'ex-breath-box' => ['unit' => 'u-breath-1', 'module' => 'breath', 'kind' => 'breath-pattern', 'base_xp' => 40],
        'ex-breath-candle' => ['unit' => 'u-breath-1', 'module' => 'breath', 'kind' => 'breath-candle', 'base_xp' => 55],
        'boss-breath-1' => ['unit' => 'u-breath-1', 'module' => 'breath', 'kind' => 'boss', 'base_xp' => 120],

        // u-breath-2
        'ex-breath-candle-long' => ['unit' => 'u-breath-2', 'module' => 'breath', 'kind' => 'breath-candle', 'base_xp' => 70],
        'ex-breath-candle-xl' => ['unit' => 'u-breath-2', 'module' => 'breath', 'kind' => 'breath-candle', 'base_xp' => 90],

        // u-pitch-1
        'ex-pitch-sustain-1' => ['unit' => 'u-pitch-1', 'module' => 'pitch', 'kind' => 'pitch-sustain', 'base_xp' => 40],
        'ex-pitch-falling-1' => ['unit' => 'u-pitch-1', 'module' => 'pitch', 'kind' => 'pitch-falling', 'base_xp' => 55],
        'ex-pitch-echo-1' => ['unit' => 'u-pitch-1', 'module' => 'pitch', 'kind' => 'pitch-echo', 'base_xp' => 55],

        // u-pitch-2
        'ex-interval-third' => ['unit' => 'u-pitch-2', 'module' => 'pitch', 'kind' => 'interval', 'base_xp' => 50],
        'ex-interval-fifth' => ['unit' => 'u-pitch-2', 'module' => 'pitch', 'kind' => 'interval', 'base_xp' => 50],
        'ex-interval-octave' => ['unit' => 'u-pitch-2', 'module' => 'pitch', 'kind' => 'interval', 'base_xp' => 50],
        'boss-pitch-1' => ['unit' => 'u-pitch-2', 'module' => 'pitch', 'kind' => 'boss', 'base_xp' => 140],

        // u-pitch-3
        'ex-scale-major' => ['unit' => 'u-pitch-3', 'module' => 'pitch', 'kind' => 'scale', 'base_xp' => 60],
        'ex-scale-minor' => ['unit' => 'u-pitch-3', 'module' => 'pitch', 'kind' => 'scale', 'base_xp' => 60],
        'ex-scale-penta' => ['unit' => 'u-pitch-3', 'module' => 'pitch', 'kind' => 'scale', 'base_xp' => 60],

        // u-theory-1
        'ex-theory-staff' => ['unit' => 'u-theory-1', 'module' => 'theory', 'kind' => 'theory-staff', 'base_xp' => 35],
        'ex-theory-rhythm' => ['unit' => 'u-theory-1', 'module' => 'theory', 'kind' => 'theory-rhythm', 'base_xp' => 35],
        'ex-theory-quiz-1' => ['unit' => 'u-theory-1', 'module' => 'theory', 'kind' => 'theory-quiz', 'base_xp' => 35],

        // u-theory-2
        'ex-theory-quiz-intervals' => ['unit' => 'u-theory-2', 'module' => 'theory', 'kind' => 'theory-quiz', 'base_xp' => 45],
        'ex-theory-quiz-keys' => ['unit' => 'u-theory-2', 'module' => 'theory', 'kind' => 'theory-quiz', 'base_xp' => 45],

        // u-tech-1
        'ex-tech-registers' => ['unit' => 'u-tech-1', 'module' => 'technique', 'kind' => 'technique-registers', 'base_xp' => 60],
        'ex-tech-vibrato' => ['unit' => 'u-tech-1', 'module' => 'technique', 'kind' => 'technique-vibrato', 'base_xp' => 70],

        // u-rep-1
        'song-solfeo-1' => ['unit' => 'u-rep-1', 'module' => 'repertoire', 'kind' => 'song', 'base_xp' => 90],
        'song-folk-1' => ['unit' => 'u-rep-1', 'module' => 'repertoire', 'kind' => 'song', 'base_xp' => 90],
    ],

    /*
    |--------------------------------------------------------------------------
    | Achievement catalog (mirror of src/game/achievements.ts)
    |--------------------------------------------------------------------------
    | Evaluated server-side against the consolidated user state. `rule` is an
    | opcode consumed by App\Domain\Achievements\AchievementEvaluator.
    |--------------------------------------------------------------------------
    */
    'achievements' => [
        ['id' => 'first-note', 'title' => 'Primera nota perfecta', 'description' => 'Canta una nota dentro de la tolerancia.', 'icon' => '🎯', 'category' => 'pitch', 'sort' => 1, 'rule' => ['type' => 'metric_at_least', 'key' => 'perfectNotes', 'value' => 1]],
        ['id' => 'first-exercise', 'title' => 'Calentando motores', 'description' => 'Completa tu primer ejercicio.', 'icon' => '🔥', 'category' => 'general', 'sort' => 2, 'rule' => ['type' => 'exercises_completed', 'value' => 1]],
        ['id' => 'streak-3', 'title' => 'Constancia', 'description' => '3 dias seguidos practicando.', 'icon' => '📅', 'category' => 'streak', 'sort' => 3, 'rule' => ['type' => 'streak_at_least', 'value' => 3]],
        ['id' => 'streak-7', 'title' => 'Semana de fuego', 'description' => '7 dias seguidos practicando.', 'icon' => '⚡', 'category' => 'streak', 'sort' => 4, 'rule' => ['type' => 'streak_at_least', 'value' => 7]],
        ['id' => 'level-5', 'title' => 'Aprendiz de cantante', 'description' => 'Alcanza el nivel 5.', 'icon' => '⭐', 'category' => 'level', 'sort' => 5, 'rule' => ['type' => 'level_at_least', 'value' => 5]],
        ['id' => 'level-10', 'title' => 'Voz en ascenso', 'description' => 'Alcanza el nivel 10.', 'icon' => '🌟', 'category' => 'level', 'sort' => 6, 'rule' => ['type' => 'level_at_least', 'value' => 10]],
        ['id' => 'fifth-master', 'title' => 'Domina la quinta', 'description' => '3 estrellas en el ejercicio de intervalo de 5ta.', 'icon' => '🎼', 'category' => 'pitch', 'sort' => 7, 'rule' => ['type' => 'exercise_stars_at_least', 'exercise' => 'ex-interval-fifth', 'value' => 3]],
        ['id' => 'air-20s', 'title' => 'Pulmones de acero', 'description' => 'Sosten el aire estable 20 segundos.', 'icon' => '🫁', 'category' => 'breath', 'sort' => 8, 'rule' => ['type' => 'metric_at_least', 'key' => 'airSeconds', 'value' => 20]],
        ['id' => 'stars-15', 'title' => 'Coleccionista', 'description' => 'Acumula 15 estrellas.', 'icon' => '✨', 'category' => 'general', 'sort' => 9, 'rule' => ['type' => 'total_stars_at_least', 'value' => 15]],
        ['id' => 'boss-1', 'title' => 'Cazador de jefes', 'description' => 'Supera tu primer jefe de unidad.', 'icon' => '👑', 'category' => 'general', 'sort' => 10, 'rule' => ['type' => 'exercise_prefix_completed', 'prefix' => 'boss-']],
        ['id' => 'vibrato', 'title' => 'Vibrato controlado', 'description' => 'Manten un vibrato de 5-7 Hz durante 3 s.', 'icon' => '〰️', 'category' => 'technique', 'sort' => 11, 'rule' => ['type' => 'metric_at_least', 'key' => 'vibratoSeconds', 'value' => 3]],
        ['id' => 'song-clear', 'title' => 'Primera cancion', 'description' => 'Completa una cancion en el modo repertorio.', 'icon' => '🎤', 'category' => 'repertoire', 'sort' => 12, 'rule' => ['type' => 'exercise_prefix_completed', 'prefix' => 'song-']],
    ],
];
