<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Progress\ConsolidatedStateBuilder;
use App\Domain\Progress\RecordExercisePayload;
use App\Domain\Progress\RecordExerciseResult;
use App\Http\Controllers\Controller;
use App\Http\Requests\PitchSessionRequest;
use App\Http\Requests\RecordResultRequest;
use App\Http\Requests\VocalRangeRequest;
use App\Models\PitchAccuracySession;
use App\Models\VocalRangeSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProgressController extends Controller
{
    public function __construct(
        private readonly ConsolidatedStateBuilder $state,
        private readonly RecordExerciseResult $record,
    ) {}

    /** Full server-authoritative state for the client to reconcile against. */
    public function state(Request $request): JsonResponse
    {
        return response()->json(['state' => $this->state->build($request->user())]);
    }

    /** Record one exercise completion from live online play. */
    public function recordResult(RecordResultRequest $request, string $exercise): JsonResponse
    {
        $payload = RecordExercisePayload::fromArray([
            'exercise_id' => $exercise,
            'score' => $request->float('score'),
            'metrics' => $request->input('metrics', []),
            'client_generated_id' => $request->input('client_generated_id'),
            'occurred_at' => $request->input('occurred_at'),
        ]);

        $outcome = $this->record->handle($request->user(), $payload);

        return response()->json([
            'outcome' => $outcome->toArray(),
            'state' => $this->state->build($request->user()->fresh()),
        ], $outcome->applied ? 201 : 200);
    }

    public function recordVocalRange(VocalRangeRequest $request): JsonResponse
    {
        $user = $request->user();
        $cgid = $request->input('client_generated_id', (string) Str::uuid());

        $snapshot = VocalRangeSnapshot::query()->firstOrCreate(
            ['user_id' => $user->id, 'client_generated_id' => $cgid],
            [
                'low_midi' => $request->integer('low_midi'),
                'high_midi' => $request->integer('high_midi'),
                'avg_pitch_error_cents' => $request->input('avg_pitch_error_cents'),
                'recorded_at' => $request->date('recorded_at') ?? now(),
            ],
        );

        if ($request->boolean('apply_to_profile')) {
            $user->update([
                'range_low_midi' => $request->integer('low_midi'),
                'range_high_midi' => $request->integer('high_midi'),
            ]);
        }

        return response()->json([
            'snapshot_id' => $snapshot->id,
            'state' => $this->state->build($user->fresh()),
        ], $snapshot->wasRecentlyCreated ? 201 : 200);
    }

    public function recordPitchSession(PitchSessionRequest $request): JsonResponse
    {
        $user = $request->user();
        $cgid = $request->input('client_generated_id', (string) Str::uuid());

        $session = PitchAccuracySession::query()->firstOrCreate(
            ['user_id' => $user->id, 'client_generated_id' => $cgid],
            [
                'module' => $request->string('module'),
                'exercise_id' => $request->input('exercise_id'),
                'avg_score' => $request->float('avg_score'),
                'avg_error_cents' => $request->float('avg_error_cents'),
                'duration_seconds' => $request->integer('duration_seconds'),
                'notes_total' => $request->input('notes_total'),
                'notes_in_tune' => $request->input('notes_in_tune'),
                'occurred_at' => $request->date('occurred_at') ?? now(),
            ],
        );

        return response()->json(
            ['session_id' => $session->id],
            $session->wasRecentlyCreated ? 201 : 200,
        );
    }
}
