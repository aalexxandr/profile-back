# Tasks

## 1. Test support for an authenticated client

Prepare the helpers first so that existing e2e tests can send the token before the guard turns on (everything stays green in this group).

- [x] 1.1 In `test/setup-e2e.ts` assign `process.env.ADMIN_TOKEN` a fixed test token of at least 32 characters (always assigned, never defaulted); add `TEST_ADMIN_TOKEN` and `adminAuth()` (returns `['Authorization', 'Bearer <token>']` for supertest `.set(...)`) to `test/helpers`, plus a `test/helpers/helpers.e2e-spec.ts` case that `adminAuth()` carries the same token the environment holds. Verify with `pnpm run test:e2e --runInBand -- helpers`.
- [x] 1.2 Make every write request in `test/case-management.e2e-spec.ts` and `test/case-image.e2e-spec.ts` (`POST`, `PATCH`, `DELETE`, `PUT` / `DELETE` image) send `.set(...adminAuth())`. Verify both files still pass unchanged in behavior (`pnpm run test:e2e --runInBand`).

## 2. Admin guard (unit level)

- [x] 2.1 Red: write `src/auth/admin.guard.spec.ts` for the guard's decisions: valid `Bearer <token>` passes, `bearer` in lower case passes, missing header / `Basic` scheme / `Bearer` without token / token without scheme / wrong token / prefix of the token / token with extra characters throw `UnauthorizedException` with one identical message, and a handler or class marked `@Public()` passes without a header. Run it and confirm it is red because the guard does not exist yet, not because of a type error in the test.
- [x] 2.2 Green: add `src/auth/public.decorator.ts` (`@Public()`) and `src/auth/admin.guard.ts` (strict header parse, sha256 digests of both tokens compared with `timingSafeEqual`, configured digest computed once, `Reflector.getAllAndOverride` for `@Public()`). Verify `pnpm test -- admin.guard` is green.
- [x] 2.3 Red then green: extend `admin.guard.spec.ts` with startup rules (constructing the guard with `ADMIN_TOKEN` missing, empty, or 31 characters throws an error that names `ADMIN_TOKEN` (and the minimum for the short case) and never contains the value; 32 characters constructs). Run red, add the check to the constructor, verify green.

## 3. Wire the guard into the app (e2e without DB)

- [x] 3.1 Red: write `test/admin-auth.e2e-spec.ts` with a stub controller (one `@Public()` route, one protected route, one protected route with a validated body, one protected upload route using `FileInterceptor`), `AuthModule` and a global `ConfigModule`, on top of `createTestApp`. Scenarios: public route is `200` without a token; protected route is `401` without a token, with a wrong token and with the wrong scheme, and `200` with the token; the `401` body has `status`, `message`, `timestamp`, `path` and the same `message` for missing and wrong token; an invalid body without a token is `401` (not `400`); an unauthenticated upload is `401` and the handler is never called; a route in the stub with no decorator is `401`. Confirm it is red because `AuthModule` does not exist.
- [x] 3.2 Green: add `src/auth/auth.module.ts` providing `AdminGuard` as `APP_GUARD`, import it in `AppModule`. Verify `pnpm run test:e2e --runInBand -- admin-auth` is green.

## 4. Protect the case routes (e2e with DB)

- [x] 4.1 Red: add scenarios to `test/case-management.e2e-spec.ts`: `POST /cases` without a token is `401` and the case does not exist afterwards; `PATCH` without a token is `401` and the name is unchanged; `DELETE` with a wrong token is `401` and the case is still readable; `PATCH` of an unknown slug without a token is `401`, not `404`; `GET /cases` and `GET /cases/:slug` stay open without a token. Add to `test/case-image.e2e-spec.ts`: `PUT /cases/:slug/image` without a token and with a wrong token is `401`, `InMemoryStorage` has no new key and `image` is unchanged; `DELETE /cases/:slug/image` without a token is `401` and the picture and its object remain. Run against the local DB and confirm the new write scenarios are red because the routes are still open (the public-read scenario is already green).
- [x] 4.2 Green: mark `GET /cases` and `GET /cases/:slug` with `@Public()` in `CaseController`. Verify `pnpm run test:e2e --runInBand` is green for `case-catalog`, `case-management`, `case-image` and `admin-auth`.

## 5. Swagger

- [x] 5.1 Red: extend `test/api-docs.e2e-spec.ts`: `components.securitySchemes` has a `http` / `bearer` scheme with a description; each of the five protected operations has a `security` entry that references it; `GET /cases` and `GET /cases/{slug}` have none; the documented error statuses now include `401` for the protected operations (and not for the two GETs) and each references `ErrorResponseDto`; `info.description` does not contain `not protected`. Confirm red.
- [x] 5.2 Green: add `addBearerAuth(...)` named `admin-token` to `src/config/swagger.config.ts` and reword the document description (public reads, token-protected writes); add `src/common/swagger/api-admin-auth.decorator.ts` (`ApiAdminAuth()` = `ApiBearerAuth('admin-token')` + `ApiErrorResponse(401, ...)`); apply it to the five protected operations in `CaseController` and mention the token requirement in their descriptions. Verify `pnpm run test:e2e --runInBand -- api-docs` is green and open `/docs` to see the Authorize button.

## 6. Documentation and configuration

- [x] 6.1 Add `ADMIN_TOKEN` to `.env.example` with a placeholder and a comment (minimum 32 characters, generate with `openssl rand -hex 32`); update `README.md` (Russian): the variable is mandatory, how to generate it, how to call a write route with `Authorization: Bearer`, how to use Authorize in `/docs`. Verify by following the README steps on a clean `.env` (app refuses to start without the variable, starts with it).
- [x] 6.2 Update `CLAUDE.md`: remove "Write routes are not protected yet (planned `admin-guard`)", describe the global guard, `@Public()`, `ADMIN_TOKEN` among the required env variables, the `adminAuth()` test helper and the `ApiAdminAuth()` decorator; add the `@Public()` rule to `src/case/CLAUDE.md` and the helper to `test/CLAUDE.md`. Verify by grep that no stale "not protected" text remains in `CLAUDE.md`, `README.md` or `src/`.

## 7. Integration check

- [x] 7.1 Run `pnpm run check` and `pnpm run test:e2e --runInBand` against the local DB (both green), then start `pnpm run start:dev` once without `ADMIN_TOKEN` to confirm startup fails naming the variable, and once with it to smoke-test with curl: `GET /cases` open, `POST /cases` `401` without a token and `201` with it (delete the created case afterwards).

## 8. Split files by concern (design decision 7)

- [x] 8.1 Red then green: write `src/auth/admin-token.util.spec.ts` for `extractBearerToken` (valid, case-insensitive scheme, missing / empty / `Basic` / `Bearer` alone / two spaces / token without scheme give `undefined`), `digestToken` (32 bytes, deterministic, different inputs differ) and `isSameToken` (equal, different, prefix, longer). Run it red (module missing), then add `src/auth/admin-token.util.ts` and verify `pnpm test -- admin-token` is green.
- [x] 8.2 Move `IS_PUBLIC_KEY`, `ADMIN_TOKEN_ENV` and `MIN_ADMIN_TOKEN_LENGTH` to `src/auth/auth.constants.ts`; make `admin.guard.ts` contain only `AdminGuard` (using the util and constants) and `public.decorator.ts` only `Public`. Verify `admin.guard.spec.ts` and `test/admin-auth.e2e-spec.ts` pass without changes.
- [x] 8.3 Move `LIST_ITEM`, `DETAIL`, `SLUG_PARAM` and `MAX_IMAGE_BYTES` from `case.controller.ts` to `src/case/case.constants.ts`. Verify `case-catalog`, `case-management`, `case-image` and `api-docs` e2e pass without changes.
- [x] 8.4 Move `ADMIN_TOKEN_SCHEME` to `src/common/swagger/swagger.constants.ts`; `api-admin-auth.decorator.ts` keeps only `ApiAdminAuth`. Verify `api-docs` e2e passes without changes.
- [x] 8.5b Move the module-level constants and the `ProcessedImage` interface out of `src/image/image-processing.service.ts` (to `image.constants.ts` and `image.types.ts`) and `IMMUTABLE_CACHE` out of `src/storage/storage.service.ts` (to `storage.constants.ts`). Verify `image-processing.service.spec.ts`, `storage.service.spec.ts` and `case-image` e2e pass without changes.
- [x] 8.5 Document the rule "one concern per file" (kinds and file names from design decision 7) in the root `CLAUDE.md`, `src/case/CLAUDE.md` and `.claude/commands/new-module.md`. Verify with grep that the rule is present in all three and that `grep -nE "^(const|function) " src/**/*.{controller,service,guard,module}.ts` finds no module-level constants or functions in class files.
- [x] 8.6 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (both green).

## Workflow follow-up

- Set `ADMIN_TOKEN` in the production environment before deploying.
- Archive the change after `pnpm run check` is green and every spec scenario is covered by a test.
