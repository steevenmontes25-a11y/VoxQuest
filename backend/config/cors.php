<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
|
| Only the real PWA origins (dev + prod) may call the API. The list comes
| from VOXQUEST_FRONTEND_ORIGINS via config/voxquest.php.
|
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => config('voxquest.frontend_origins', ['http://localhost:5173']),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // Token auth (Authorization header) does not need credentialed cookies.
    'supports_credentials' => false,

];
