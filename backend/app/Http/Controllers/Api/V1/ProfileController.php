<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateProfileRequest $request): UserResource
    {
        $user = $request->user();
        $data = $request->safe()->except('mark_onboarded');

        if ($request->boolean('mark_onboarded') && $user->onboarded_at === null) {
            $data['onboarded_at'] = now();
        }

        $user->fill($data)->save();

        return new UserResource($user->refresh());
    }

    /**
     * Hard-delete the account and everything hanging off it. Every child table
     * uses ON DELETE CASCADE, so removing the user row removes xp_events,
     * achievements, streak, progress and tokens in one shot.
     */
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            $user->tokens()->delete();
            $user->delete();
        });

        return response()->json(['message' => 'Cuenta eliminada.']);
    }
}
