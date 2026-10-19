# Design

## Context

See proposal.md for the motivation. Current state:

- `CaseController` is the only controller with routes; `AppController` is empty. `ConfigModule` is global, secrets are read with `ConfigService.getOrThrow` (the S3 variables in `StorageService`), so a missing variable stops the app at startup.
- Errors go through `AllExceptionFilter` (body `{ status, message, timestamp, path }`), registered in `configureApp()`. A thrown `UnauthorizedException` is formatted by it with no extra work.
- Swagger has no security scheme; `ApiErrorResponse(status, description)` documents error statuses; `test/api-docs.e2e-spec.ts` checks the document without a DB.
- E2E tests come in two kinds (see `test/CLAUDE.md`): no-DB with stub controllers on top of `configureApp()`, and DB tests with the whole `AppModule`. `createTestApp` builds both.
- Nest runs guards before interceptors and pipes, which is what lets an unauthenticated upload be refused before `FileInterceptor` buffers the file.

## Goals / Non-Goals

**Goals:**

- Closed by default: forgetting to annotate a new route must give `401`, not an open route.
- One small, self-contained `src/auth/` module with no new dependencies.
- Misconfiguration (no token, short token) fails at startup, not at the first request.

**Non-Goals:**

- Users, roles, login endpoint, JWT, refresh tokens, token expiry or rotation tooling. A token change is an env change plus a restart.
- Rate limiting or lockout against token guessing (a separate concern; the 32-character minimum makes guessing infeasible).
- A `WWW-Authenticate` response header and CORS configuration (no browser admin client exists yet).
- Protecting `/docs` and `/docs-json`; the document describes the API but exposes no data.

## Decisions

### 1. Global `APP_GUARD` with a `@Public()` opt-out

`AuthModule` registers `AdminGuard` as `APP_GUARD`; `AppModule` imports it. The guard reads a metadata flag set by `@Public()` via `Reflector.getAllAndOverride([handler, class])` and lets such routes through.

Alternatives: an explicit `@UseGuards(AdminGuard)` on write routes is simpler for one controller but leaves a new module open if the decorator is forgotten. Rejected in the exploration in favour of fail-closed.

Consequence: only `GET /cases` and `GET /cases/:slug` get `@Public()`. The public catalog e2e tests are the safety net against accidentally closing a public route.

### 2. Compare sha256 digests with `timingSafeEqual`

The guard parses `Authorization` with a strict pattern (`Bearer` case-insensitive, one space, a non-empty token), hashes both the presented token and the configured one with sha256 and compares the two 32-byte digests with `crypto.timingSafeEqual`. Hashing first gives equal-length buffers, so the comparison neither throws on a length mismatch nor leaks the token length. The configured token is hashed once in the constructor.

Alternatives: `===` (timing leak), `timingSafeEqual` on raw buffers after a length check (leaks the length). Rejected.

### 3. Validate `ADMIN_TOKEN` in the guard constructor

`ConfigService.getOrThrow('ADMIN_TOKEN')` plus a length check (`>= 32`) run in the constructor, so Nest fails during bootstrap and the error names the variable and the minimum. The error message never contains the value.

Alternative: a `validate` function / Joi schema in `ConfigModule.forRoot`. It would validate the whole env centrally, but the project validates each secret where it is used (S3 in `StorageService`), and a single check does not justify introducing a schema. Revisit if more variables need rules.

### 4. Always `401`, one message

`UnauthorizedException` with a fixed message for every failure (missing header, wrong scheme, empty token, wrong token). No `403`: a single role means there is no authenticated-but-forbidden state. Identical responses give an attacker no oracle.

### 5. Swagger via one composed decorator

A decorator `ApiAdminAuth()` (in `src/common/swagger/`) combines `@ApiBearerAuth('admin-token')` and `@ApiErrorResponse(401, ...)` so the five protected operations stay consistent. It is applied per method, not on the controller class, because the two GET operations must not show a lock. `getSwaggerConfig()` adds `addBearerAuth({ type: 'http', scheme: 'bearer', description }, 'admin-token')` and its description drops the "not protected yet" sentence. The Authorize button in `/docs` then sends the token for manual checks.

### 6. Test support

`test/setup-e2e.ts` sets `process.env.ADMIN_TOKEN` to a fixed test token of 32+ characters (assigned, not defaulted, so a real token in the developer's environment never reaches a test run). `test/helpers` exports `TEST_ADMIN_TOKEN` and `adminAuth()` returning `['Authorization', 'Bearer ...']` for supertest's `.set(...)`. Existing write requests in the e2e files add it.

### 7. One concern per file

A file holds one thing. A class file (guard, service, controller, module) contains the class and nothing else: no module-level constants, helper functions, regular expressions or types. Those move out by kind:

| Kind                                        | Where                                   | Example                        |
| ------------------------------------------- | --------------------------------------- | ------------------------------ |
| Constants, metadata keys, env names, limits | `<area>.constants.ts`                   | `src/auth/auth.constants.ts`   |
| Pure helper functions                       | `<area>.util.ts` (own `*.util.spec.ts`) | `src/auth/admin-token.util.ts` |
| Types and interfaces                        | `<area>.types.ts`                       | `src/case/case.types.ts`       |
| Decorator                                   | its own file, only the decorator        | `public.decorator.ts`          |
| DTO                                         | one class per file under `dto/`         | `dto/create-case.dto.ts`       |

Applied here:

- `src/auth/auth.constants.ts`: `IS_PUBLIC_KEY`, `ADMIN_TOKEN_ENV`, `MIN_ADMIN_TOKEN_LENGTH`.
- `src/auth/admin-token.util.ts`: `extractBearerToken(header)`, `digestToken(token)`, `isSameToken(presented, expectedDigest)`; the Bearer pattern stays private to this file.
- `src/auth/admin.guard.ts`: only `AdminGuard`; `public.decorator.ts`: only `Public`.
- `src/case/case.constants.ts`: `LIST_ITEM`, `DETAIL` (serialization options), `SLUG_PARAM`, `MAX_IMAGE_BYTES`; `case.controller.ts` keeps only the class.
- `src/common/swagger/swagger.constants.ts`: `ADMIN_TOKEN_SCHEME`; `api-admin-auth.decorator.ts` keeps only `ApiAdminAuth`.

Pure refactor: no behavior or API change, so the specs are untouched and the existing guard, e2e and api-docs tests are the safety net. The rule is written into `CLAUDE.md` and the `/new-module` command so new modules follow it. Test level: the new util is unit (pure functions, no mocks).

Alternative: leave private helpers in the class file. Rejected: the class file then mixes policy (the guard) with mechanics (parsing, hashing), and the helpers cannot be unit-tested on their own.

### Test levels

| Behavior                                                                                                               | Level                                          | Mocks                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Header parsing, token comparison, `@Public()` bypass, startup errors (missing / short token)                           | unit (`admin.guard.spec.ts`)                   | fake `ConfigService`, hand-built `ExecutionContext`, real `Reflector`                                                                         |
| `401` body shape, uniform message, `401` before `400` and before file handling, public route open                      | e2e without DB (`test/admin-auth.e2e-spec.ts`) | stub controller with one `@Public()` and one protected route, `AuthModule` + global `ConfigModule`; `createTestApp` already swaps the storage |
| Case write routes reject / accept the token, nothing changes after a `401`, no storage write on unauthenticated upload | e2e with DB (`case-management`, `case-image`)  | real `AppModule`, `InMemoryStorage`                                                                                                           |
| Security scheme, per-operation `security`, `401` documented, no `not protected` text                                   | e2e without DB (`api-docs`)                    | none                                                                                                                                          |

## Risks / Trade-offs

- [A static token never expires and is the only secret] → 32-character minimum, constant-time comparison, kept out of logs and responses, rotation is an env change; the token must be generated randomly (`openssl rand -hex 32` in README).
- [A browser admin client would hold a long-lived token] → out of scope now; if one appears, replace the guard's credential check with login + JWT behind the same `@Public()` / guard structure.
- [Forgetting `@Public()` on a future public route closes it] → it fails loudly (`401` in the e2e of that route) rather than silently opening data.
- [No rate limit on guessing] → token entropy makes brute force infeasible; add throttling separately if the API is exposed to heavy abuse.
- [CI and production need the new variable] → e2e and unit runs get their token from the test setup file, so CI needs no secret; production (and any local `pnpm run start:dev`) must set `ADMIN_TOKEN` before the app starts, or it refuses to boot, which is intended.

## Migration Plan

1. Generate a token (`openssl rand -hex 32`) and set `ADMIN_TOKEN` in the local `.env` and in the production environment before deploying.
2. Deploy. Public reads keep working; write clients start sending `Authorization: Bearer <token>`.
3. Rollback: revert the change; no data or schema is involved. The variable can stay set.
