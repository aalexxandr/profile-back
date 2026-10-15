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

### 1. One table, two projections via response DTOs and a mapper

`CaseListItemDto` and `CaseDetailDto` are plain classes with `@ApiProperty` for Swagger. Pure functions `toCaseListItem(row)` / `toCaseDetail(row)` in `src/case/case.mapper.ts` build them from a row. The service returns DTOs, never rows.

- Alternative: select columns in the query. Rejected: the ORM select API is less stable in the RC, and a mapper is trivially unit-testable with no DB.
- Alternative: a separate entity or view. Rejected by the user and unnecessary.
- Tests: mapper is **unit** (no mocks); the HTTP shape is **e2e**.

### 2. `achievements` as a typed `jsonb` value object

Declare `type Achievement { title String, description String, metric String }` and `achievements Achievement[]` in the contract, stored as `jsonb`. Achievements are always read and written with their case and are never queried on their own.

- Alternative: a `case_achievements` table. Rejected: a join, ordering column and extra CRUD for data with no independent identity.
- Alternative: untyped `Json`. Rejected: loses types; validation then lives only in the DTO.
- Open risk: whether Prisma 8 RC supports a _list_ of value objects (`Achievement[]`). First implementation step is a spike (see Risks); the fallback is a single `Json` column typed manually and validated by the DTO.

### 3. Period as two date columns

`startedAt` (required) and `endedAt` (nullable, `null` = ongoing), mapped to `started_at` / `ended_at`. API exposes `period: { startedAt, endedAt }` with ISO dates (`YYYY-MM-DD`). The cross-field rule `endedAt >= startedAt` is a custom class-validator constraint on the DTO (**unit** tested).

- Alternative: free-text period string ("2022-2024"). Rejected: not sortable or computable.

### 4. Visibility and ordering live in the service

The service filters `published = true` and orders by `sortOrder` asc, `createdAt` desc for list; detail applies the same `published` filter and throws `NotFoundException` for a missing row. Unknown and unpublished are indistinguishable (same status and message) so drafts do not leak. Update and delete operate regardless of `published`.

- Tests: **e2e with DB** for ordering and visibility (real query semantics matter); **unit** for the service's not-found handling with a stubbed `PrismaService`.

### 5. Writes

- `CreateCaseDto` gains `company?`, `teamSize?`, `startedAt`, `endedAt?`, `sortOrder?`, `published?`; `achievements` becomes a nested `AchievementDto[]` (`@ValidateNested({ each: true })`, `@Type`). Slug gets a kebab-case regex and a max of 50.
- `UpdateCaseDto = PartialType(OmitType(CreateCaseDto, ['slug']))` from `@nestjs/mapped-types`; with `forbidNonWhitelisted`, a `slug` in the body is a `400` for free.
- `description` limit is raised from 500 to 2000 (the sample text is already ~400 chars).
- Duplicate slug: the unique violation is translated to `ConflictException` in the service (exact error shape to be confirmed in the spike; alternative is a pre-check with `.first({ slug })`, which is racy, so it is only the fallback).
- `DELETE` returns `204` (`@HttpCode(204)`); a missing row is `404`.
- `Role` stays a native enum (`FRONTEND | FULLSTACK`); the frontend maps it to a label.

### 6. Migration

Use the history-keeping path (`db:migration:plan --name case-api-fields` -> `db:migrate` -> `db:verify`), run by the user because DB-mutating commands are denied to the agent. New NOT NULL columns without a sensible default (`startedAt`) need a default or a backfill; since existing rows are throwaway sample data, the plan may truncate `cases` first. This is called out as a manual step in tasks.

### 7. Docs

`CLAUDE.md` currently says the case module is a throwaway with no tests; `src/case/CLAUDE.md` and `test/CLAUDE.md` repeat it, and `collectCoverageFrom` excludes `case/**`. All three are updated, and the coverage exclusion is removed for `case/**` where unit-testable files exist.

## Risks / Trade-offs

- **Prisma 8 RC may not support `Achievement[]` value objects** -> task 1 is a spike with a red test; fallback is typed `Json`. Decision 2 is revisited only if the fallback is used.
- **Write endpoints stay open until `admin-guard`** -> acceptable for a local/early deployment; do not deploy publicly before `admin-guard`. Mentioned in the proposal.
- **Drafts cannot be listed** -> a draft is only reachable by slug through `PATCH`/`DELETE`; an admin list arrives with `admin-guard`.
- **Breaking `achievements` shape** -> sample data is discarded; the frontend must target the new shape.
- **DB e2e needs the schema applied** -> the user runs the migration before `test:e2e`.

## Migration Plan

1. User applies the migration (`db:migration:plan` -> `db:migrate` -> `db:verify`) after the contract change.
2. Deploy order: migration, then the new API. Rollback: revert the commit and the migration (`achievements` data loss is accepted).

## Open Questions

- Exact `endedAt` semantics in the UI ("present" label) is a frontend concern.
