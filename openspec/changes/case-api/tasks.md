# Tasks

## 1. Contract and migration (spike)

- [ ] 1.1 Spike: in `prisma/contract.prisma` declare `type Achievement` and `achievements Achievement[]` (jsonb), add `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published` (default `false`); run `pnpm run db:generate` and verify `contract.d.ts` types `achievements` as an array of objects. If lists of value objects are unsupported, fall back to typed `Json` and note it in design.md
- [ ] 1.2 Ask the user to plan and apply the migration (`db:migration:plan --name case-api-fields` -> `db:migrate` -> `db:verify`, truncating sample rows first if needed) and verify `db:verify` is clean. Committed `migrations/` files are the deliverable
- [ ] 1.3 Add `src/case/case.mapper.ts` stubs only if needed for compilation; verify `pnpm run typecheck` passes

## 2. Validation of case input

- [ ] 2.1 Red: unit tests (`create-case.dto.spec.ts`) for the DTO rules in `case-management` (kebab-case slug, `teamSize >= 1`, `endedAt >= startedAt`, achievement shape and limits, unknown fields); run and confirm they fail for the right reason
- [ ] 2.2 Implement `AchievementDto`, new `CreateCaseDto` fields, the kebab-case slug rule and the period-order constraint; verify the 2.1 tests are green
- [ ] 2.3 Red then green: unit test `update-case.dto.spec.ts` (all fields optional, `slug` rejected); implement `UpdateCaseDto = PartialType(OmitType(CreateCaseDto, ['slug']))`; verify green

## 3. Response projections

- [ ] 3.1 Red: unit tests (`case.mapper.spec.ts`) asserting `toCaseListItem` returns exactly the five list-item keys and `toCaseDetail` returns the detail keys with `company`, `teamSize`, `period.endedAt` as `null` when absent and no `published`/`sortOrder`/`createdAt`/`updatedAt`; confirm red
- [ ] 3.2 Implement `CaseListItemDto`, `CaseDetailDto` (with Swagger `@ApiProperty`) and the mapper; verify the 3.1 tests are green

## 4. Read endpoints

- [ ] 4.1 Red: unit tests (`case.service.spec.ts`, stubbed `PrismaService`) for `findBySlug` throwing `NotFoundException` for a missing row, identical for unpublished and unknown; confirm red
- [ ] 4.2 Red: DB e2e (`test/case-catalog.e2e-spec.ts`, `AppModule` via `createTestApp`, unique slugs, cleanup in `afterAll`) covering the `case-catalog` scenarios: only published listed, list-item keys, ordering by `sortOrder` then newest, detail fields, `404` for unknown and unpublished; confirm red
- [ ] 4.3 Implement `findAll` and `findBySlug` with the published filter, ordering and mapping, and update the controller to return DTOs; verify 4.1 and 4.2 are green

## 5. Write endpoints

- [ ] 5.1 Red: unit tests in `case.service.spec.ts` for create (defaults `published=false`, `sortOrder=0`; duplicate slug -> `ConflictException`), update (missing row -> `NotFoundException`) and delete (missing row -> `NotFoundException`); confirm red
- [ ] 5.2 Red: DB e2e (`test/case-management.e2e-spec.ts`) covering the `case-management` scenarios: create defaults and hidden draft, create published with optional fields, duplicate `409`, validation `400`s, publish a draft via `PATCH`, untouched fields preserved, `slug` in `PATCH` body `400`, `PATCH`/`DELETE` unknown `404`, `DELETE` `204` then `GET` `404`; confirm red
- [ ] 5.3 Implement create/update/delete in the service and `PATCH`/`DELETE` routes (`@HttpCode(204)` for delete); verify 5.1 and 5.2 are green and the Swagger document lists both response schemas

## 6. Docs and coverage config

- [ ] 6.1 Update `CLAUDE.md`, `src/case/CLAUDE.md`, `test/CLAUDE.md` (case is no longer a throwaway, tests exist) and `README.md` (endpoints, new fields, migration step); verify no remaining "throwaway" or "no tests for it" statement about the case module
- [ ] 6.2 Remove `!case/**` from `collectCoverageFrom` in `package.json` where files are unit-tested (keep excluding e2e-only files such as controllers/modules); verify `pnpm run test:cov` meets the thresholds

## 7. Final verification

- [ ] 7.1 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (with the migration applied) and verify both are green; run `pnpm run format:check`
