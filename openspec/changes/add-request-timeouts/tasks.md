# Tasks

## 1. Timeout values

- [x] 1.1 Red: add `src/timeout/timeout.constants.spec.ts` asserting `STORAGE_TIMEOUT_MS` (10 000) is less than `REQUEST_TIMEOUT_MS` (30 000); run it and confirm it fails because the constants do not exist yet (module not found, not a type error elsewhere)
- [x] 1.2 Green: create `src/timeout/timeout.constants.ts` with `REQUEST_TIMEOUT_MS`, `STORAGE_TIMEOUT_MS`, the `REQUEST_TIMEOUT` injection token and the two messages (`Request timed out`, `An external service did not respond in time`); verify 1.1 passes

## 2. Outgoing call limit (`TimeoutService`)

- [x] 2.1 Red: add `src/timeout/timeout.service.spec.ts` covering the `request-timeouts` scenarios "Storage call exceeds its limit" (rejects with `GatewayTimeoutException` and the generic message, the signal passed to the operation is aborted), "Storage call finishes in time" (resolves with the value, timer cleared) and "Storage error inside the limit is not a timeout" (same error rethrown); run it red
- [x] 2.2 Green: implement `src/timeout/timeout.service.ts` (`run(operation, ms, name)` with `AbortController`, timer cleared in `finally`, warning logged on expiry); verify 2.1 passes

## 3. Incoming request limit (`RequestTimeoutInterceptor`)

- [x] 3.1 Red: add `src/timeout/request-timeout.interceptor.spec.ts`: a handler observable slower than the limit becomes `ServiceUnavailableException('Request timed out')`, a fast one passes its value, a `NotFoundException` within the limit passes unchanged; run it red
- [x] 3.2 Green: implement `src/timeout/request-timeout.interceptor.ts` (rxjs `timeout`, limit injected via `REQUEST_TIMEOUT`); verify 3.1 passes
- [x] 3.3 Red: add `test/request-timeout.e2e-spec.ts` (no DB): stub controller with a 200 ms and a 10 ms handler and one throwing `404`, `TimeoutModule` imported, `REQUEST_TIMEOUT` overridden to 50 ms / 200 ms; assert the three "Bound the time of an incoming request" scenarios, including the standard error body and `path`; run it red
- [x] 3.4 Green: create `src/timeout/timeout.module.ts` (`@Global()`, provides `TimeoutService`, `REQUEST_TIMEOUT`, `APP_INTERCEPTOR` → `RequestTimeoutInterceptor`, exports `TimeoutService`) and import it in `src/app.module.ts`; verify 3.3 passes with `pnpm run test:e2e --runInBand -- request-timeout`

## 4. Storage goes through the timeout

- [x] 4.1 Red: extend `src/storage/storage.service.spec.ts`: `put` and `delete` call `send(command, { abortSignal })` through `TimeoutService.run` with `STORAGE_TIMEOUT_MS` and a stalled `send` makes `put` reject with `504`; update `createService` to pass a `TimeoutService`; run it red
- [x] 4.2 Green: inject `TimeoutService` into `StorageService` and wrap both `send` calls; verify 4.1 and the existing storage tests pass, and `CaseService` specs stay green (`pnpm test -- src/case src/storage`)

## 5. Upload answers 504 and keeps the picture

- [x] 5.1 Red: add a `failNextPut(error)` hook to `test/helpers/in-memory-storage.ts` (covered in `test/helpers/helpers.e2e-spec.ts`), then add the scenario "Storage does not answer in time" to `test/case-image.e2e-spec.ts` and `test/case-background.e2e-spec.ts` (case with an existing picture/background, next put rejects with `GatewayTimeoutException` and the generic message → `504`, standard body, previous `image`/`blurImage` and `backgroundImage`/`backgroundBlurImage` unchanged); run them red against the local DB
- [x] 5.2 Green: fix whatever the scenarios reveal (expected: none beyond groups 2-4, since `CaseService` already leaves the row untouched when `put` rejects); verify with `pnpm run test:e2e --runInBand -- case-image case-background`

## 6. Swagger

- [x] 6.1 Red: in `test/api-docs.e2e-spec.ts` update the expected error statuses per operation (`503` on every `/cases` operation, `504` only on `PUT /cases/{slug}/image` and `PUT /cases/{slug}/background`, each with a non-empty description and `ErrorResponseDto`); run it red
- [x] 6.2 Green: add `@ApiErrorResponse(503, ...)` to every operation and `@ApiErrorResponse(504, ...)` to both uploads in `src/case/case.controller.ts`, and mention the limits in the upload descriptions; verify 6.1 passes

## 7. Docs and final check

- [x] 7.1 Update `CLAUDE.md` (Architecture: `src/timeout/` module, global request limit `503`, `TimeoutService.run` for every external client, values in `timeout.constants.ts`; Error handling: `503`/`504`) and `README.md` (Russian, short section on timeouts); verify both mention `TimeoutService` and the two limits
- [x] 7.2 Run `pnpm run check` and confirm typecheck, lint and unit tests are green; also run `pnpm run test:e2e --runInBand` and `pnpm run format:check`
