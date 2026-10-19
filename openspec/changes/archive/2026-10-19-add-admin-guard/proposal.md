# Proposal

## Why

The write endpoints of the case catalog (`POST`, `PATCH`, `DELETE /cases`, `PUT` / `DELETE /cases/:slug/image`) are open to anyone who can reach the API: a stranger can create, rewrite or delete portfolio cases and upload files to the bucket. `CLAUDE.md` already lists an `admin-guard` as planned. The portfolio has a single administrator and no user accounts, so the lightest protection that closes the hole is a static admin token.

## What Changes

- Add a global guard (`APP_GUARD`) that requires `Authorization: Bearer <ADMIN_TOKEN>` on every route unless the route is marked `@Public()`. Closed by default: a new route is protected until it is opened explicitly.
- Mark `GET /cases` and `GET /cases/:slug` as `@Public()`; everything else (create, update, delete, image upload and removal) requires the token.
- A missing, malformed or wrong token gives `401` with the standard error body. There is no `403`: there is only one role.
- The token is compared in constant time (sha256 digests + `timingSafeEqual`), so neither its content nor its length leaks through timing.
- New env variable `ADMIN_TOKEN` (at least 32 characters) read with `getOrThrow`: the app refuses to start without it, like the `S3_*` variables.
- The guard runs before the `ValidationPipe` and `FileInterceptor`, so an unauthenticated request never has a body parsed or a file buffered.
- Swagger: register a bearer security scheme, mark protected operations with `@ApiBearerAuth` and document `401` on each of them; update the document description that says write endpoints are "not protected yet".
- Tests: unit tests for the guard, an e2e helper that sends the token, `401` / success e2e scenarios, and a check in `api-docs` that protected operations declare security and `401`. Existing write e2e tests start sending the token.
- Docs: `.env.example`, `README.md`, `CLAUDE.md` (remove "not protected yet", describe the guard and `ADMIN_TOKEN`), and the `ADMIN_TOKEN` variable in the CI e2e job.

## Capabilities

### New Capabilities

- `admin-auth`: access control for the API: which routes are public, how an administrator authenticates with a bearer token, what an unauthenticated request receives, and the startup requirement for the token.

### Modified Capabilities

- `case-management`: create, update and delete require the admin token and answer `401` without it.
- `case-image`: uploading and removing a picture require the admin token and answer `401` without it.
- `api-documentation`: protected operations declare the bearer security scheme and the `401` response.

## Impact

- Code: new `src/auth/` (guard, `@Public()` decorator, module wiring), `AppModule`, `CaseController`, `src/config/swagger.config.ts`.
- **BREAKING** for API clients: write requests without the token now fail with `401`. The frontend, scripts and the Swagger UI must send the token (the Swagger UI gets an Authorize button).
- Config: `ADMIN_TOKEN` in `.env`, `.env.example`, CI workflow and the production environment.
- Tests: `test/helpers`, `test/setup-e2e.ts`, `case-management`, `case-image`, `api-docs` e2e; new unit and e2e specs for the guard.
- No new dependencies and no database changes.
