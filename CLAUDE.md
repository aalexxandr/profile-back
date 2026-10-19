# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Portfolio backend: NestJS 12, TypeScript 6 (deliberately pinned to the 6.x branch — Nest CLI and typescript-eslint don't support TS 7 yet), Prisma ORM **8** (release candidate) on PostgreSQL 18. Node >= 24.11, pnpm. README.md (in Russian) has the full setup walkthrough.

## Commands

```bash
docker compose --env-file .env up -d postgres   # local DB on host port 5434
pnpm run db:init          # first run: generate contract + create missing DB objects
pnpm run start:dev        # watch mode (runs db:generate first), API on :3000 (PORT overrides)
pnpm run build            # db:generate + nest build
pnpm run lint             # eslint on src and test (--max-warnings 0); lint:fix to autofix
pnpm run typecheck        # tsc --noEmit
pnpm run check            # typecheck + lint + tests; run before finishing a task
pnpm run format           # prettier --write; format:check to verify
pnpm test                 # unit tests only (src/**/*.spec.ts, no DB); jest runs with --experimental-vm-modules
pnpm run test:cov         # unit tests with coverage thresholds (used in CI)
pnpm run test:e2e --runInBand
pnpm test -- -t "name"    # single test by name; or pass a file path
```

Do not use `pnpm update --latest` (bypasses version pins); update major versions one at a time.

`.env.example` is the template. `.env` must define `POSTGRES_URI` — both the app (via `ConfigService.getOrThrow`) and Prisma CLI (`prisma.config.ts`) read it — and the six S3 variables `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` (Selectel bucket `portfolio`, public read; `StorageService` reads them with `getOrThrow`, so the app fails at startup without them). E2E tests that use the DB hit the real local DB (unique data, deleted afterwards), so the schema must already be applied and the DB must not be production (`assertSafeDatabase` refuses non-local hosts). Some e2e run without a DB.

## Code quality tooling

- ESLint (`eslint.config.mjs`): typed `recommendedTypeChecked`, `no-floating-promises` and `no-unsafe-argument` are errors, `simple-import-sort` and `unused-imports` enforced; unused args/vars must start with `_`. Don't silence rules, fix the code.
- `tsconfig.json` is strict (`noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- Claude hooks (`.claude/settings.json`): after each Edit/Write of a `.ts` file `.claude/hooks/format-lint.sh` runs prettier + eslint --fix; the Stop hook `.claude/hooks/stop-check.sh` blocks finishing while `typecheck`, `lint` or unit tests fail, and once per stop asks for tests if `src` changed without any spec file in the working tree. Settings also deny reading `.env` and running DB-mutating commands (`db:update`, `db:migrate`, `db:init`, `prisma db *`): ask the user to run those.
- Git hooks (husky): pre-commit runs lint-staged + secretlint, commit-msg enforces Conventional Commits (commitlint).
- CI: `.github/workflows/ci.yml` (typecheck, lint, format:check, tests, e2e against postgres 18, build). Dependabot ignores TS and `@types/node` majors.
- Slash commands `/check`, `/new-module <name>`, `/add-tests [path]`; subagent `nest-reviewer`. Per-area conventions: `src/case/CLAUDE.md`, `test/CLAUDE.md`. Skill `writing-tests` for writing tests.

## Prisma 8 (differs from Prisma 7 and earlier)

- There is **no Prisma Client**. Schema is `prisma/contract.prisma`; `pnpm run db:generate` (`prisma contract emit`) writes `src/generated/prisma/contract.json` + `contract.d.ts`. These are generated, not hand-edited, and not committed.
- Runtime is `@prisma/orm-postgres/runtime`. `PrismaService` (`src/prisma/prisma.service.ts`) builds a client from `contractJson` and exposes per-model accessors (e.g. `get cases()` → `client.orm.public.Case`). Add a getter there for each new model.
- Query API is the new ORM style (`.create({...})`, `.first({ slug })`, `.orderBy(row => row.createdAt.desc()).all()`), not `findMany`/`where`.
- Schema syntax is also new (`pg.enum(Role)`, `native_enum`, `temporal.updatedAtJsDate()`, `@map` for snake_case columns).
- Old commands `prisma db push` / `prisma generate` don't apply. Use `db:plan` → `db:update` for prototyping, or `db:migration:plan --name <name>` → `db:migrate` → `db:verify` to keep history. Files in `migrations/` are committed.
- Prisma skills are available under `.claude/skills` (e.g. prisma-upgrade-v7, prisma-client-api); the "prisma skills sync" CLI message can be ignored.

## Architecture

Standard Nest layout: feature modules under `src/` (currently only `case/`: controller → service → `PrismaService`, request DTOs validated with class-validator, response DTOs applied by `ClassSerializerInterceptor`). `case` is the portfolio's project catalog: `GET /cases` (published only, compact list items), `GET /cases/:slug` (detail), and `POST` / `PATCH` / `DELETE` for management. Write routes are not protected yet (planned `admin-guard`). `PrismaModule` provides the DB service; `ConfigModule` is global.

Case pictures have their own routes, `PUT /cases/:slug/image` (multipart, one `file`) and `DELETE /cases/:slug/image`; the JSON `POST` / `PATCH` bodies do not accept picture fields. Two support modules serve them: `src/storage/` (`StorageService` over `@aws-sdk/client-s3`: `put`, `delete`, `publicUrl`; imports nothing but `ConfigService`) and `src/image/` (`ImageProcessingService.process(buffer)`: sniffs the real format with `sharp`, accepts only JPEG/PNG/WebP, re-encodes to a genuine WebP at most 1920 px wide with metadata stripped, and builds the ~20 px blur placeholder as a `data:image/webp;base64,...` URI; invalid input becomes `400`). The DB stores only the object key (`image_key`, `cases/<slug>/<content hash>.webp`) and the placeholder (`blur_image`); responses expose `image` (absolute URL = `S3_PUBLIC_URL` + key) and `blurImage`, both `null` without a picture, and never the key. The S3 object is saved before the row, the old one removed after it, and cleanups are best effort (see `src/case/CLAUDE.md`). Tests never touch the real bucket: `createTestApp` always replaces `StorageService` with `InMemoryStorage` (`test/helpers/in-memory-storage.ts`), so CI needs no `S3_*` variables.

App-wide setup lives in `configureApp()` (`src/app.setup.ts`), not `main.ts`, so e2e tests can reuse it: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), the `logger` middleware, `AllExceptionFilter`, a global `ClassSerializerInterceptor` (response DTOs with `@Expose()` + `@SerializeOptions`), Swagger (`src/utils/swagger.util.ts`, config in `src/config/swagger.config.ts`), and shutdown hooks. E2E tests should call `configureApp` to match production behavior.

## Error handling

Errors are handled globally by `AllExceptionFilter` (`src/filters/all-exeption.filter.ts`), registered in `configureApp()`. It sends the standard body `{ status, message, timestamp, path }`, keeps validation error lists, and hides internal errors behind a generic `500`. Before building the response it runs `toHttpException` (`src/filters/database-error.ts`), which translates database constraint violations into HTTP errors (currently a unique violation, `sqlState 23505`, becomes `409 Resource already exists`).

- Do not catch database errors in services or controllers and do not re-implement this mapping. Let them propagate.
- For domain errors throw Nest's `HttpException` subclasses (`NotFoundException`, `ConflictException`, ...); the filter formats them.
- To handle another constraint (e.g. `23502` not-null, `23503` foreign key), add a case to `toHttpException` with a unit test in `src/filters/database-error.spec.ts`.

## API documentation (Swagger)

Quality Swagger documentation is **mandatory**, not optional polish: it is the first page a client developer or a reviewer opens (`/docs`, JSON at `/docs-json`), and `/docs-json` is also the source the frontend generates its TypeScript types from, so its accuracy is part of the contract. There is no Swagger plugin, so nothing is inferred from types: write it explicitly, every time you add or change an endpoint, a DTO field or a response status.

- Controller: `@ApiTags`, `@ApiOperation({ summary, description })` on every operation (the description states the rules a client needs: draft vs published, ordering, what stays unchanged), `@ApiParam` for every path parameter (description + example), and one decorator per response status: `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiNoContentResponse` with `type` and `description`, and `@ApiErrorResponse(status, description)` (`src/common/swagger/api-error-response.decorator.ts`) for every error the operation can return, including `400` when a body or query is validated.
- DTOs, request and response alike: `@ApiProperty` / `@ApiPropertyOptional` on every field with `description`, `example` and the constraints the API enforces (`maxLength`, `minimum`, `pattern`, `enum`, `maxItems`); nullable fields get `nullable: true`. Request DTOs repeat the `class-validator` limits (share constants such as the slug regex where possible), so keep both in sync.
- Errors share one schema, `ErrorResponseDto` (`src/common/dto/error-response.dto.ts`), which mirrors the body of `AllExceptionFilter`; update it if the filter's body changes.
- Document-level text (title, description, tags) lives in `src/config/swagger.config.ts`; add a tag description when you add a tag.
- Prove it with a test: `test/api-docs.e2e-spec.ts` reads `/docs-json` without a DB; add scenarios there (and to the `api-documentation` OpenSpec spec) for every new operation or schema. Do not leave a schema in the document without properties.

## Tests

The project is developed with **TDD**: red → green → refactor. For new functionality worth covering with tests, and for bug fixes, the test is written **before** the code: first a failing test (run it and make sure it is red for the right reason, not because of a compile error), then the minimal code to green, then refactor with green tests. A bug fix starts with a test that reproduces the bug. What to cover: a new endpoint (e2e), a new DTO or validation rules (unit), logic in a service, filter, pipe or guard (unit). Tests go in the same change as the code. A test may be skipped only for docs and config edits, renames without behavior change, and empty stubs; if you skip a test where one is appropriate, explain why. How to write them: the `writing-tests` skill (`.claude/skills/writing-tests/SKILL.md`), conventions in `test/CLAUDE.md`. Unit tests live next to the code (`*.spec.ts`), e2e in `test/*.e2e-spec.ts`; helpers in `test/helpers` (`createTestApp`, `assertSafeDatabase`, `uniqueId`); `/add-tests` writes tests for the current changes. The `case` module is covered like any other: `src/case/*.spec.ts` (DTO rules, response serialization, service) and `test/case-catalog.e2e-spec.ts`, `test/case-management.e2e-spec.ts` (HTTP + DB).

In OpenSpec changes TDD is encoded in `openspec/config.yaml`: tasks are built as "test → implementation" pairs, and apply writes no code before a red test.

## Language

Talk to the user in Russian. `README.md` is in Russian. Everything else (CLAUDE.md files, skills, commands, agents, hook messages, OpenSpec artifacts and config) is written in English to save tokens.

## Keeping docs current

When a change alters the project's architecture (new or removed modules, changes to app-wide setup in `configureApp()`, the Prisma/DB workflow, commands, or env variables), update this `CLAUDE.md` and `README.md` in the same change so they don't drift from the code.

`.mcp.json` configures Postgres, GitHub, Context7 and Figma MCP servers.
