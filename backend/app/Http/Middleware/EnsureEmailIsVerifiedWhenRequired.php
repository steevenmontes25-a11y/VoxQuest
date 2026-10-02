<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks write endpoints only when VOXQUEST_REQUIRE_EMAIL_VERIFICATION=true.
 * While that flag is false (the default, so testing is frictionless) this
 * middleware is a no-op.
 */
class EnsureEmailIsVerifiedWhenRequired
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('voxquest.require_email_verification')) {
            return $next($request);
        }

        $user = $request->user();

        if ($user === null || ! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Verifica tu correo para continuar.',
                'code' => 'email_unverified',
            ], 409);
        }

        return $next($request);
    }
}
