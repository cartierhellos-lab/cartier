<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // API路由：认证失败返回JSON而不是重定向
        $middleware->redirectGuestsTo(fn() => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // 所有认证异常 → JSON 401
        $exceptions->render(function (\Throwable $e, Request $request) {
            $isApi = str_starts_with($request->path(), 'system/')
                  || str_starts_with($request->path(), 'cloud/')
                  || str_starts_with($request->path(), 'client/')
                  || str_starts_with($request->path(), 'TcardTask/')
                  || str_starts_with($request->path(), 'TcardClient/')
                  || str_starts_with($request->path(), 'upload')
                  || str_starts_with($request->path(), 'rsikNumber');

            if (!$isApi) return null; // 非API请求走默认处理

            $code = 500;
            $message = $e->getMessage();

            // 认证相关
            if ($e instanceof AuthenticationException
                || $e instanceof \Tymon\JWTAuth\Exceptions\JWTException
                || str_contains($message, 'Unauthenticated')
                || str_contains($message, 'Token')
                || str_contains($message, 'jwt')
                || str_contains($message, 'login')) {
                $code = 401;
                $message = 'Unauthenticated. Please login.';
            }
            // 路由未找到
            elseif ($e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
                   || str_contains($message, 'not found')) {
                $code = 404;
                $message = 'Route not found: ' . $request->path();
            }

            return response()->json([
                'success' => false,
                'message' => $message,
                'code' => $code,
            ], $code);
        });
    })->create();
