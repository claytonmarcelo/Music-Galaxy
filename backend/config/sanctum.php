<?php

return [

    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,::1',
        env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
    ))),

    'guards' => ['web'],

    'expiration' => env('SANCTUM_TOKEN_EXPIRATION', null),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'personal_access_token_result_limit' => env('SANCTUM_PERSONAL_ACCESS_TOKEN_RESULT_LIMIT', 50),

    'secret' => env('SANCTUM_SECRET'),

];