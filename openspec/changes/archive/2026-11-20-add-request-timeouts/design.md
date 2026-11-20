# Design

## Context

See proposal.md - Why. Relevant current state:

- `StorageService` (`src/storage/storage.service.ts`) builds `S3Client` with no timeout options and calls `client.send(command)` without an abort signal.
- `CaseService.setPicture` awaits `storageService.put` before saving the row; `removeObject` wraps `storageService.delete` in a best-effort `try/catch`.
- `AllExceptionFilter` formats any `HttpException` into `{ status, message, timestamp, path }`; app-wide guards are registered as `APP_*` providers by a feature module (`AuthModule` → `APP_GUARD`).
- E2E apps always replace `StorageService` with `InMemoryStorage`, so no e2e test reaches the real SDK.
- The user chose: one shared timeout module, both incoming and outgoing limits, values as constants (no env variables).

## Goals / Non-Goals

**Goals:**

- One module (`src/timeout/`) owns the timeout policy: the values and the two mechanisms (request limit, outgoing call limit).
- An outgoing call is actually cancelled on expiry (socket destroyed), not just abandoned.
- Any future external client plugs in with one call: `timeoutService.run(...)`.

**Non-Goals:**

- No per-route overrides of the request limit (no decorator) until a route needs it.
- No env configuration of the limits.
- No timeout on PostgreSQL queries (local DB, own pool; out of scope).
- Not cancelling the handler's work when the request limit fires (Node has no general cancellation; the outgoing limit is what stops the real waiting).

## Decisions

### 1. Module layout (one concern per file)

```
src/timeout/
  timeout.constants.ts        REQUEST_TIMEOUT_MS = 30_000, STORAGE_TIMEOUT_MS = 10_000,
                              REQUEST_TIMEOUT (injection token), messages
  timeout.module.ts           @Global(); provides TimeoutService, REQUEST_TIMEOUT value,
                              APP_INTERCEPTOR → RequestTimeoutInterceptor; exports TimeoutService
  timeout.service.ts          run<T>(operation: (signal: AbortSignal) => Promise<T>, ms: number, name: string): Promise<T>
  request-timeout.interceptor.ts
```

`TimeoutModule` is imported once in `AppModule`. `@Global()` so that `StorageModule` (and later modules) inject `TimeoutService` without importing the module; this is "connect it where needed" with no wiring per feature.

Alternative: a plain helper function `withTimeout()` in a `*.util.ts`. Rejected: the user asked for a service, and a provider can be replaced in tests and later carry logging/metrics in one place.

### 2. Outgoing limit: `TimeoutService.run`

Creates an `AbortController`, starts a timer for `ms`, calls `operation(controller.signal)` and races it against the timer. On expiry it calls `controller.abort()`, logs a warning with `name` and `ms`, and rejects with `GatewayTimeoutException('An external service did not respond in time')`. The timer is cleared in `finally`. An error raised by the operation before expiry is rethrown unchanged; the `AbortError` the SDK raises after our own abort is ignored in favour of the timeout exception.

`StorageService.put` / `delete` become `this.timeoutService.run((signal) => this.client.send(cmd, { abortSignal: signal }), STORAGE_TIMEOUT_MS, 'storage')`. The SDK's own retries happen inside the 10 s budget, so the total wait is bounded no matter how many attempts the SDK makes.

Why throw `GatewayTimeoutException` directly instead of a domain error mapped in the filter: the service sits at the app boundary already, the filter formats any `HttpException`, and `CaseService.removeObject` keeps swallowing it as before. Why `504`: the API acted as a gateway to a dependency that did not answer, which is exactly what `504` means; it also differs from `500` (dependency answered with an error).

Alternative: only `requestHandler: { connectionTimeout, requestTimeout }` on `S3Client`. Rejected as the sole mechanism: it is SDK-specific (not reusable for the next client) and per attempt, so retries multiply it.

### 3. Incoming limit: `RequestTimeoutInterceptor`

Global interceptor registered as `APP_INTERCEPTOR` with rxjs `timeout({ first: limit })`; a `TimeoutError` becomes `ServiceUnavailableException('Request timed out')`, other errors pass through unchanged. The limit is injected through the `REQUEST_TIMEOUT` token (value `REQUEST_TIMEOUT_MS`), so tests override it with a small number without env variables.

Why `503` and not `408`: `408` tells the client that _it_ was too slow to send; here the server was too slow. Why an interceptor: it is the Nest-idiomatic place, runs after the guard (unauthenticated requests are still rejected first) and wraps `FileInterceptor`, so a slow upload is bounded too.

Ordering of limits: `STORAGE_TIMEOUT_MS` (10 s) < `REQUEST_TIMEOUT_MS` (30 s), so a stalled storage call surfaces as `504` before the request limit turns it into `503`. A unit test asserts this invariant on the constants.

### 4. Swagger

`@ApiErrorResponse(503, 'The request was not handled in time')` on every operation of `CaseController`, `@ApiErrorResponse(504, 'The storage did not respond in time')` on both upload operations. Per-method, matching the existing style.

### 5. Tests (level and mocks)

| Behavior                                                                                                                                     | Level                                                                 | Mocks                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeoutService.run`: resolves in time, rejects with 504 after `ms`, aborts the signal, rethrows the operation's own error, clears the timer | unit (`timeout.service.spec.ts`)                                      | jest fake timers; operation is a manual promise                                                                                         |
| Constants invariant (storage < request)                                                                                                      | unit (`timeout.constants.spec.ts`)                                    | none                                                                                                                                    |
| `RequestTimeoutInterceptor`: 503 after limit, passes value and other errors                                                                  | unit (`request-timeout.interceptor.spec.ts`)                          | `CallHandler` returning rxjs observables (`timer`, `throwError`)                                                                        |
| `StorageService` passes `abortSignal` to `send` and goes through `TimeoutService` (put and delete); a stalled `send` yields 504              | unit (existing `storage.service.spec.ts`)                             | `@aws-sdk/client-s3` mocked as today; real `TimeoutService` with a small `ms` via fake timers, or a stub `run`                          |
| Global 503 with standard body, 200 in time, 404 unchanged                                                                                    | e2e without DB (`test/request-timeout.e2e-spec.ts`)                   | stub controller with delayed handlers; `REQUEST_TIMEOUT` overridden to 50/200 ms                                                        |
| Upload answers 504 and keeps the case's picture (image and background)                                                                       | e2e with DB (`case-image.e2e-spec.ts`, `case-background.e2e-spec.ts`) | `InMemoryStorage` gets a `failNextPut(error)` hook; the test makes it reject with the same `GatewayTimeoutException` the service throws |
| Swagger 503/504 per operation                                                                                                                | e2e without DB (`test/api-docs.e2e-spec.ts`)                          | none                                                                                                                                    |

`createTestApp` must keep working: since `TimeoutModule` is imported by `AppModule`, DB e2e get the real 30 s limit, which is harmless.

## Risks / Trade-offs

- [The request limit answers `503` but the handler keeps running and may still write to the DB afterwards] → Outgoing limits are shorter, so the realistic stalls (storage) finish first; document the behavior in `CLAUDE.md`.
- [A late write after the 503 tries to send a second response] → rxjs unsubscribes from the handler's observable, Nest does not write twice; covered by the e2e scenario (no crash, single response).
- [30 s may be short for a 10 MB upload on a slow client link] → The limit covers parsing by `FileInterceptor`; 10 MB in 30 s needs ~2.7 Mbit/s. Acceptable for an admin-only route; raise the constant if needed.
- [Fake timers and rxjs/AbortController interplay in jest is fiddly] → Prefer real timers with tiny limits (≤ 50 ms) where fake timers misbehave.

## Migration Plan

No data or env changes. Deploy as usual; rollback = revert the commit. `CLAUDE.md` (Architecture, Error handling) and `README.md` get a short section on the timeout module and its limits.
