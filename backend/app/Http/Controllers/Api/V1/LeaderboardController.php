<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaderboards\LeaderboardService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function __construct(private readonly LeaderboardService $boards) {}

    public function weeklyXp(Request $request): JsonResponse
    {
        return response()->json($this->boards->weeklyXp($request->user()));
    }

    public function streaks(Request $request): JsonResponse
    {
        return response()->json($this->boards->longestActiveStreaks($request->user()));
    }
}
