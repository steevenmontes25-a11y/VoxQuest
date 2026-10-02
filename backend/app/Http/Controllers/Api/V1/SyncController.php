<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sync\SyncBatchProcessor;
use App\Http\Controllers\Controller;
use App\Http\Requests\SyncRequest;
use Illuminate\Http\JsonResponse;

class SyncController extends Controller
{
    public function __construct(private readonly SyncBatchProcessor $processor) {}

    public function store(SyncRequest $request): JsonResponse
    {
        $result = $this->processor->process($request->user(), [
            'idempotency_key' => $request->string('idempotency_key')->value(),
            'device_id' => $request->input('device_id'),
            'events' => $request->input('events', []),
        ]);

        return response()->json($result);
    }
}
