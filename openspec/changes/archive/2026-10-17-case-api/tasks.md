# Tasks

## 1. Contract and migration (spike)

- [x] 1.1 Spike: in `prisma/contract.prisma` declare `type Achievement` and `achievements Achievement[]` (jsonb), add `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published` (default `false`); run `pnpm run db:generate` and verify `contract.d.ts` types `achievements` as an array of objects. If lists of value objects are unsupported, fall back to typed `Json` and note it in design.md
- [x] 1.2 Ask the user to plan and apply the migration (`db:migration:plan --name case-api-fields` -> `db:migrate` -> `db:verify`, truncating sample rows first if needed) and verify `db:verify` is clean. Committed `migrations/` files are the deliverable
- [x] 1.3 Add `src/case/case.mapper.ts` stubs only if needed for compilation; verify `pnpm run typecheck` passes

## 2. Validation of case input

- [x] 2.1 Red: unit tests (`create-case.dto.spec.ts`) for the DTO rules in `case-management` (kebab-case slug, `teamSize >= 1`, `endedAt >= startedAt`, achievement shape and limits, unknown fields); run and confirm they fail for the right reason
- [x] 2.2 Implement `AchievementDto`, new `CreateCaseDto` fields, the kebab-case slug rule and the period-order constraint; verify the 2.1 tests are green
- [x] 2.3 Red then green: unit test `update-case.dto.spec.ts` (all fields optional, `slug` rejected); implement `UpdateCaseDto = PartialType(OmitType(CreateCaseDto, ['slug']))`; verify green

## 3. Response projections

- [x] 3.1 Red: unit tests (`case.mapper.spec.ts`) asserting `toCaseListItem` returns exactly the five list-item keys and `toCaseDetail` returns the detail keys with `company`, `teamSize`, `period.endedAt` as `null` when absent and no `published`/`sortOrder`/`createdAt`/`updatedAt`; confirm red
- [x] 3.2 Implement `CaseListItemDto`, `CaseDetailDto` (with Swagger `@ApiProperty`) and the mapper; verify the 3.1 tests are green

## 4. Read endpoints

- [x] 4.1 Red: unit tests (`case.service.spec.ts`, stubbed `PrismaService`) for `findBySlug` throwing `NotFoundException` for a missing row, identical for unpublished and unknown; confirm red
- [x] 4.2 Red: DB e2e (`test/case-catalog.e2e-spec.ts`, `AppModule` via `createTestApp`, unique slugs, cleanup in `afterAll`) covering the `case-catalog` scenarios: only published listed, list-item keys, ordering by `sortOrder` then newest, detail fields, `404` for unknown and unpublished; confirm red
- [x] 4.3 Implement `findAll` and `findBySlug` with the published filter, ordering and mapping, and update the controller to return DTOs; verify 4.1 and 4.2 are green

## 5. Write endpoints

- [x] 5.1 Red: unit tests in `case.service.spec.ts` for create (defaults `published=false`, `sortOrder=0`; duplicate slug -> `ConflictException`), update (missing row -> `NotFoundException`) and delete (missing row -> `NotFoundException`); confirm red
- [x] 5.2 Red: DB e2e (`test/case-management.e2e-spec.ts`) covering the `case-management` scenarios: create defaults and hidden draft, create published with optional fields, duplicate `409`, validation `400`s, publish a draft via `PATCH`, untouched fields preserved, `slug` in `PATCH` body `400`, `PATCH`/`DELETE` unknown `404`, `DELETE` `204` then `GET` `404`; confirm red
- [x] 5.3 Implement create/update/delete in the service and `PATCH`/`DELETE` routes (`@HttpCode(204)` for delete); verify 5.1 and 5.2 are green and the Swagger document lists both response schemas

## 6. Docs and coverage config

- [x] 6.1 Update `CLAUDE.md`, `src/case/CLAUDE.md`, `test/CLAUDE.md` (case is no longer a throwaway, tests exist) and `README.md` (endpoints, new fields, migration step); verify no remaining "throwaway" or "no tests for it" statement about the case module
- [x] 6.2 Remove `!case/**` from `collectCoverageFrom` in `package.json` where files are unit-tested (keep excluding e2e-only files such as controllers/modules); verify `pnpm run test:cov` meets the thresholds

## 7. Final verification

- [x] 7.1 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (with the migration applied) and verify both are green; run `pnpm run format:check`

## 8. Standard serialization instead of the mapper

- [x] 8.1 Red: unit test `src/case/dto/case-serialization.spec.ts` serializing a full database row with `plainToInstance` + `instanceToPlain` (`strategy: 'excludeAll'`) through `CaseListItemDto` and `CaseDetailDto`: exactly the list-item keys / detail keys (flat `startedAt`, `endedAt`, no `period`), `company`, `teamSize`, `endedAt` kept as `null`, no `published`/`sortOrder`/`createdAt`/`updatedAt`, achievements reduced to `title`, `description`, `metric`; update the e2e expectations in `test/case-catalog.e2e-spec.ts` and `test/case-management.e2e-spec.ts` to the flat fields; run and confirm they fail for the right reason
- [x] 8.2 Implement: `@Expose()` on all fields of `CaseListItemDto`, `CaseDetailDto` and `AchievementDto`, `@Type` for achievements, drop `CasePeriodDto`; register `ClassSerializerInterceptor` globally in `configureApp()`; add `@SerializeOptions({ type, strategy: 'excludeAll' })` to `findAll`, `findBySlug`, `createCase` and `updateCase`; make the service return database rows; verify the 8.1 tests, the request-DTO unit tests and the e2e tests are green
- [x] 8.3 Refactor: delete `src/case/case.mapper.ts` and `src/case/case.mapper.spec.ts`, adapt `src/case/case.service.spec.ts` to rows (published filter, ordering, not-found and conflict checks stay; shape assertions now live in 8.1), remove the response-DTO entries from `collectCoverageFrom` in `package.json`; verify `grep -rn mapper src test` finds nothing and `pnpm run test:cov` meets the thresholds
- [x] 8.4 Update docs: `CLAUDE.md` (the list of app-wide setup in `configureApp()` gains the serializer), `src/case/CLAUDE.md` (replace the mapper bullet with the serialization convention), `README.md` (flat dates in the detail description); verify `grep -rniE "mapper|period" CLAUDE.md src/case/CLAUDE.md README.md` has no stale mentions

## 9. Final verification

- [x] 9.1 Run `pnpm run check`, `pnpm run test:e2e --runInBand`, `pnpm run format:check` and `pnpm run build`; verify all are green

## 10. Central database error handling

- [x] 10.1 Red: unit tests `src/filters/database-error.spec.ts` (an error with `sqlState '23505'` becomes a `ConflictException`; an unrelated `Error`, an error with another `sqlState` and a non-object value are returned unchanged) and a new case in `src/filters/all-exeption.filter.spec.ts` (a `23505` error yields status `409` with the standard body); in `src/case/case.service.spec.ts` replace the `ConflictException` and "rethrows" tests with one asserting that a database error from `create` propagates unchanged; run and confirm they fail for the right reason
- [x] 10.2 Implement `src/filters/database-error.ts`, call it first in `AllExceptionFilter`, and delete `isUniqueViolation`, the `try/catch` and the `ConflictException` import from `CaseService`; verify the 10.1 tests and the existing e2e duplicate-slug test (`409`) are green
- [x] 10.3 Update the agent-facing docs: `CLAUDE.md` (the global `AllExceptionFilter` translates database errors; new constraint codes are added in `src/filters/database-error.ts`; services must not catch database errors) and `src/case/CLAUDE.md` (replace the bullet about mapping `sqlState` to `ConflictException` in the service); verify `grep -rn "isUniqueViolation\|23505" src` finds only `src/filters` and its tests, and the docs mention the handler
- [x] 10.4 Run `pnpm run check`, `pnpm run test:e2e --runInBand`, `pnpm run format:check` and `pnpm run build`; verify all are green

## 11. Complete Swagger documentation

- [x] 11.1 Red: e2e test `test/api-docs.e2e-spec.ts` without a DB (`createTestApp` with the real `CaseController` and a stubbed `CaseService`) reading `/docs-json` and covering every scenario of the `api-documentation` spec (operation summaries and descriptions, `info.description` and tag description, `slug` parameter description and example, all `CreateCaseDto` properties with required/optional split and the slug/teamSize/role constraints, `UpdateCaseDto` without `slug` and required fields, `AchievementDto` properties, per-operation error statuses referencing `ErrorResponseDto`); run and confirm it fails for the right reason (request schemas are empty today)
- [x] 11.2 Implement: `@ApiProperty` (description, example, constraints) on every field of `CreateCaseDto` and `AchievementDto`, `ErrorResponseDto` in `src/common/dto/` with an `@ApiErrorResponse(status, description)` decorator, `@ApiTags`, `@ApiOperation`, `@ApiParam` and error decorators on `CaseController`, description and tag description in `getSwaggerConfig()`, a proper `example` for `endedAt`; verify 11.1 is green and the existing Swagger check in `test/case-catalog.e2e-spec.ts` still passes
- [x] 11.3 Write the AI instructions: a mandatory "API documentation (Swagger)" section in `CLAUDE.md` (every new or changed operation, DTO field or status code gets `@ApiOperation`, `@ApiParam`, documented responses with `ErrorResponseDto` for errors, and `@ApiProperty` with description, example and constraints on request and response DTOs; there is no Swagger plugin so nothing is inferred; verify with `test/api-docs.e2e-spec.ts` and `/docs`), a pointer in `src/case/CLAUDE.md`, a Swagger step in `.claude/commands/new-module.md`, a "Swagger documentation complete" item in `.claude/agents/nest-reviewer.md`, and the rule in `openspec/config.yaml` (`rules.tasks`); verify with `grep -rli swagger CLAUDE.md src/case/CLAUDE.md .claude openspec/config.yaml` that all five files mention it
- [x] 11.4 Run `pnpm run check`, `pnpm run test:e2e --runInBand`, `pnpm run format:check` and `pnpm run build`; open `/docs-json` once and confirm no schema used by `/cases` is empty; verify all are green
