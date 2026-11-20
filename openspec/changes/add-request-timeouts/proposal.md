# Proposal

## Why

`PUT /cases/:slug/image` hung for minutes when the S3 endpoint did not accept connections: `S3Client` has no timeout, so the request waited for the OS TCP timeout plus SDK retries, and the client got no answer at all. Nothing in the app bounds how long a request or an outgoing call may take, so any slow dependency can hold a connection open indefinitely.

## What Changes

- New `timeout` module with one place for the timeout policy: `TimeoutService` (bounds any outgoing call and aborts it on expiry) and the timeout values as constants in `timeout.constants.ts` (no env variables).
- Global request timeout: every incoming HTTP request that is not answered within the limit gets `503 Service Unavailable` with the standard error body.
- Outgoing calls to the storage (`StorageService.put` / `delete`) run through `TimeoutService`; a storage call that does not finish in time is aborted and the upload answers `504 Gateway Timeout` with the standard error body, leaving the case unchanged. Best-effort deletions stay best effort (a timed-out delete is logged, not returned).
- Swagger: every operation documents `503`; `PUT /cases/{slug}/image` and `PUT /cases/{slug}/background` also document `504`.
- Docs: `CLAUDE.md` and `README.md` describe the new module and the limits.

## Capabilities

### New Capabilities

- `request-timeouts`: how long the API waits for an incoming request and for outgoing calls to external services, and what the client receives when a limit is exceeded.

### Modified Capabilities

- `case-image`: "Stay consistent when the storage fails" gains the case of a storage that does not answer (`504`, case unchanged).
- `case-background-image`: the background upload fails fast with `504` when the storage does not answer.
- `api-documentation`: the error statuses per operation now include `503` everywhere and `504` on both uploads.

## Impact

- Code: new `src/timeout/` (module, service, interceptor, constants); `src/storage/storage.service.ts` (calls wrapped, abort signal passed to the SDK); `src/app.module.ts` (imports `TimeoutModule`); `src/case/case.controller.ts` (Swagger decorators).
- API: new possible statuses `503` (any route) and `504` (uploads). Not breaking: these replace a hang.
- Tests: unit tests for `TimeoutService` and the interceptor, `StorageService` spec, a no-DB e2e for the global timeout, `test/api-docs.e2e-spec.ts`, an upload e2e with a stalled in-memory storage.
- No new dependencies (`rxjs` and the AWS SDK abort support are already present), no env changes.
