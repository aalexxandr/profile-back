# Design

## Context

`src/case/` is a layered Nest module (controller -> service -> `PrismaService`) over a single `Case` model. Today the controller returns raw DB rows, `achievements` is `String[]`, and `findBySlug` returns `null` (a `200` with an empty body) for an unknown slug. Prisma 8 has no client: queries go through the contract ORM (`.first({ slug })`, `.orderBy(...).all()`), and the schema lives in `prisma/contract.prisma`. See proposal.md for scope; images and write-endpoint protection are separate changes (`case-images`, `admin-guard`).

## Goals / Non-Goals

**Goals:**

- Explicit response contracts (list-item and detail) decoupled from the table shape.
- Keep the layering from `src/case/CLAUDE.md`: no logic in the controller, no DB access outside the service.
- Every behavior in the specs covered by a test written first.

**Non-Goals:**

- Images, blur placeholders, object storage.
- Authentication or API-key guard; admin listing of drafts.
- Pagination (the catalog is a few dozen rows at most) and i18n.

## Decisions

### 1. One table, two projections via Nest serialization

`CaseListItemDto` and `CaseDetailDto` (the latter extends the former) are classes whose every public field carries `@Expose()` and `@ApiProperty`. Routes declare the shape with `@SerializeOptions({ type: CaseListItemDto | CaseDetailDto, strategy: 'excludeAll' })`, and `ClassSerializerInterceptor` is registered globally in `configureApp()`. With `excludeAll`, only exposed fields reach the client, so `published`, `sortOrder`, `createdAt` and `updatedAt` are dropped without any code. The service returns database rows; it does not know the response shape. `AchievementDto` gets `@Expose()` on its fields (it is shared with the request side, where the decorator is harmless) and the nested field uses `@Type(() => AchievementDto)`.

- Alternative: a hand-written mapper (`toCaseListItem` / `toCaseDetail`). Rejected: not the standard Nest approach, and the point of this change is to use the framework's own mechanism.
- Alternative: select columns in the query. Rejected: the ORM select API is less stable in the RC.
- Alternative: a separate entity or view. Rejected by the user and unnecessary.
- Tests: serialization of the DTO classes is **unit** (no mocks, `plainToInstance` + `instanceToPlain` with the same options); the HTTP shape is **e2e** (exact key lists).

### 2. `achievements` as a typed `jsonb` value object

Declare `type Achievement { title String, description String, metric String }` and `achievements Achievement[]` in the contract, stored as `jsonb`. Achievements are always read and written with their case and are never queried on their own.

- Alternative: a `case_achievements` table. Rejected: a join, ordering column and extra CRUD for data with no independent identity.
- Alternative: untyped `Json`. Rejected: loses types; validation then lives only in the DTO.
- Open risk: whether Prisma 8 RC supports a _list_ of value objects (`Achievement[]`). First implementation step is a spike (see Risks); the fallback is a single `Json` column typed manually and validated by the DTO.

### 3. Period as two date columns

`startedAt` (required) and `endedAt` (nullable, `null` = ongoing), mapped to `started_at` / `ended_at`. API exposes flat `startedAt` and `endedAt` with ISO dates (`YYYY-MM-DD`); the frontend composes the range. The cross-field rule `endedAt >= startedAt` is a custom class-validator constraint on the DTO (**unit** tested).

- Alternative: free-text period string ("2022-2024"). Rejected: not sortable or computable.

### 4. Visibility and ordering live in the service

The service filters `published = true` and orders by `sortOrder` asc, `createdAt` desc for list; detail applies the same `published` filter and throws `NotFoundException` for a missing row. Unknown and unpublished are indistinguishable (same status and message) so drafts do not leak. Update and delete operate regardless of `published`.

- Tests: **e2e with DB** for ordering and visibility (real query semantics matter); **unit** for the service's not-found handling with a stubbed `PrismaService`.

### 5. Writes

- `CreateCaseDto` gains `company?`, `teamSize?`, `startedAt`, `endedAt?`, `sortOrder?`, `published?`; `achievements` becomes a nested `AchievementDto[]` (`@ValidateNested({ each: true })`, `@Type`). Slug gets a kebab-case regex and a max of 50.
- `UpdateCaseDto = PartialType(OmitType(CreateCaseDto, ["slug"]))` from `@nestjs/swagger` (same validation inheritance as mapped-types, plus Swagger metadata); with `forbidNonWhitelisted`, a `slug` in the body is a `400` for free.
- `description` limit is raised from 500 to 2000 (the sample text is already ~400 chars).
- Duplicate slug: the service does not catch anything; the unique violation (`sqlState 23505`) is translated to `409` by the global exception filter (decision 8). A pre-check with `.first({ slug })` was rejected as racy.
- `DELETE` returns `204` (`@HttpCode(204)`); a missing row is `404`.
- `Role` stays a native enum (`FRONTEND | FULLSTACK`); the frontend maps it to a label.

### 6. Migration

Use the history-keeping path (`db:migration:plan --name case-api-fields` -> `db:migrate` -> `db:verify`), run by the user because DB-mutating commands are denied to the agent. New NOT NULL columns without a sensible default (`startedAt`) need a default or a backfill; since existing rows are throwaway sample data, the plan may truncate `cases` first. This is called out as a manual step in tasks.

### 7. Docs

`CLAUDE.md` currently says the case module is a throwaway with no tests; `src/case/CLAUDE.md` and `test/CLAUDE.md` repeat it, and `collectCoverageFrom` excludes `case/**`. All three are updated, and the coverage exclusion is removed for `case/**` where unit-testable files exist.

### 8. Database errors are translated centrally

`src/filters/database-error.ts` exports a pure function `toHttpException(exception: unknown): unknown`. For an error carrying `sqlState === '23505'` (Prisma 8 surfaces constraint violations as `SqlQueryError` with a `sqlState`) it returns `new ConflictException('Resource already exists')`; any other value is returned unchanged. `AllExceptionFilter` calls it first, then continues with its existing `HttpException` handling, so translated errors get the standard body `{ status, message, timestamp, path }`. Services never catch database errors. The message is generic and carries no constraint name or SQL detail, so internals do not leak.

- Alternative: a second `@Catch(SqlQueryError)` filter. Rejected: the error class is not exported publicly by the RC runtime, so matching on `sqlState` is the stable contract; one filter also keeps a single response format.
- Alternative: keep `isUniqueViolation` in each service. Rejected: duplicated knowledge of a library-specific error shape, and every new module would repeat it.
- Extensible: further SQLSTATE codes (e.g. `23502` not-null, `23503` foreign key) become one more case in the same function. Not in scope here.
- Tests: `toHttpException` is **unit** (plain objects with `sqlState`, no DB); `AllExceptionFilter` gets a **unit** case with a mocked `ArgumentsHost` (existing style in `all-exeption.filter.spec.ts`); the end-to-end `409` on a duplicate slug stays in the existing **e2e** test.
- Docs: `CLAUDE.md` and `src/case/CLAUDE.md` tell the agent that this global handler exists and must be extended, never bypassed with a `try/catch` in a service.

### 9. Complete Swagger documentation, explicit and tested

Request DTOs get explicit `@ApiProperty` on every field (description, example, and the constraints the API enforces: `maxLength`, `minimum`, `pattern`, `enum`, `maxItems`); `UpdateCaseDto` inherits them through `PartialType`/`OmitType` from `@nestjs/swagger`. A shared `ErrorResponseDto` (`status`, `message`, `timestamp`, `path`, matching `AllExceptionFilter`) lives in `src/common/dto/`, and a small decorator wraps `@ApiResponse` for it so controllers state `@ApiErrorResponse(404, 'Unknown case')` instead of repeating the schema. Controllers add `@ApiTags`, `@ApiOperation({ summary, description })` and `@ApiParam`; `DocumentBuilder` gets a description and a tag description.

- Alternative: the Swagger plugin of the Nest CLI. Rejected: it works at build time, ts-jest would need extra configuration for a test to see what users see, and the project deliberately has no plugin; explicit decorators are visible in the code.
- Alternative: document only the new fields. Rejected: the review of the generated document showed that request bodies were empty, so everything is covered at once.
- Tests: **e2e without DB** in `test/api-docs.e2e-spec.ts` (the real `CaseController` with a stubbed `CaseService`, `createTestApp`, read `/docs-json`); it covers every scenario of the `api-documentation` spec. The existing DB e2e check of the two response schemas stays.
- Process: the rule that quality Swagger documentation is mandatory is written into `CLAUDE.md`, `src/case/CLAUDE.md`, the `new-module` command and the `nest-reviewer` checklist, and into `openspec/config.yaml` (`rules.tasks`) so future changes plan it.

## Risks / Trade-offs

- **Constraints are written twice (class-validator and `@ApiProperty`) and can drift** -> `test/api-docs.e2e-spec.ts` asserts the key constraints (slug length and pattern, `teamSize` minimum, `role` enum); keeping the numbers in shared constants is a possible follow-up.
- **The `sqlState` error shape is specific to the Prisma 8 RC** -> isolated in `toHttpException`, covered by unit tests, and the e2e duplicate test fails loudly if a Prisma update changes it.
- **Prisma 8 RC may not support `Achievement[]` value objects** -> task 1 is a spike with a red test; fallback is typed `Json`. Decision 2 is revisited only if the fallback is used.
- **A forgotten `@Expose()` silently removes a field from the response** -> the e2e tests assert the exact key list of both views, and the serialization unit test does the same for the DTO classes.
- **Unverified: that `SerializeOptions` passes `strategy: 'excludeAll'` to both `plainToInstance` and `instanceToPlain`** (the docs show `type` and options separately) -> the red serialization test in task 8.1 fails if it does not; the fallback is a `ClassSerializerInterceptor` subclass or `@Exclude()` on the entity.
- **Write endpoints stay open until `admin-guard`** -> acceptable for a local/early deployment; do not deploy publicly before `admin-guard`. Mentioned in the proposal.
- **Drafts cannot be listed** -> a draft is only reachable by slug through `PATCH`/`DELETE`; an admin list arrives with `admin-guard`.
- **Breaking `achievements` shape** -> sample data is discarded; the frontend must target the new shape.
- **DB e2e needs the schema applied** -> the user runs the migration before `test:e2e`.

## Migration Plan

1. User applies the migration (`db:migration:plan` -> `db:migrate` -> `db:verify`) after the contract change.
2. Deploy order: migration, then the new API. Rollback: revert the commit and the migration (`achievements` data loss is accepted).

## Open Questions

- Exact `endedAt` semantics in the UI ("present" label) is a frontend concern.
