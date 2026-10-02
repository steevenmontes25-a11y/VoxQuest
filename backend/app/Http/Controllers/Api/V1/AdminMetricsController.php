<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Admin\AdminMetricsService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AdminMetricsController extends Controller
{
    public function __invoke(AdminMetricsService $metrics): JsonResponse
    {
        return response()->json($metrics->snapshot());
    }
}
