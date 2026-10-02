<?php

use App\Http\Controllers\Api\V1\AdminMetricsController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmailVerificationController;
use App\Http\Controllers\Api\V1\LeaderboardController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ProgressController;
use App\Http\Controllers\Api\V1\SyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {

    // ---- Public / auth ----------------------------------------------------
    Route::middleware('throttle:auth')->group(function (): void {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
            ->middleware('auth:sanctum');
    });

    // Signed email-verification link (opened in a browser, not from the PWA fetch).
    Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed'])
        ->name('verification.verify');

    // ---- Authenticated --------------------------------------------------
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);

        Route::get('/profile', [ProfileController::class, 'show']);
        Route::patch('/profile', [ProfileController::class, 'update']);
        Route::delete('/account', [ProfileController::class, 'destroy']);

        // ---- Progress & gamification (writes gated by optional email verify) --
        Route::middleware('verified.optional')->group(function (): void {
            Route::get('/state', [ProgressController::class, 'state']);
            Route::post('/exercises/{exercise}/result', [ProgressController::class, 'recordResult']);
            Route::post('/vocal-range', [ProgressController::class, 'recordVocalRange']);
            Route::post('/pitch-sessions', [ProgressController::class, 'recordPitchSession']);

            // Offline-first batch sync. Its own tighter limiter.
            Route::post('/sync', [SyncController::class, 'store'])
                ->withoutMiddleware('throttle:api')
                ->middleware('throttle:sync');
        });

        // ---- Leaderboards ------------------------------------------------
        Route::get('/leaderboards/weekly-xp', [LeaderboardController::class, 'weeklyXp']);
        Route::get('/leaderboards/streaks', [LeaderboardController::class, 'streaks']);

        // ---- Admin (is_admin only) -------------------------------------
        Route::middleware('admin')->get('/admin/metrics', AdminMetricsController::class);
    });
});
