## 1. Validation of the create and update bodies

- [x] 1.1 Red: in `src/case/dto/create-case.dto.spec.ts` add tests that a body without `projectLink` is valid, `""` and `ftp://example.com` are rejected, and a valid URL still passes; run them and confirm the first one fails for the right reason
- [x] 1.2 Green: in `src/case/dto/create-case.dto.ts` make `projectLink` optional (`@IsOptional()`, `projectLink?: string`, `@ApiPropertyOptional` with description "omit if the project has no public link")
- [x] 1.3 Red: in `src/case/dto/update-case.dto.spec.ts` cover an update body without `projectLink` and with a valid one; keep it green with the DTO change

## 2. Database and service

- [x] 2.1 Red: in `src/case/case.service.spec.ts` add a test that `createCase` without `projectLink` stores `projectLink: null`
- [x] 2.2 Green: in `prisma/contract.prisma` change `projectLink` to `String?`; in `src/case/case.service.ts` store `caseData.projectLink ?? null`; update `src/case/case.fixtures.ts` only if its types require it
- [ ] 2.3 Run `pnpm run db:generate` to refresh the contract, then `pnpm run db:migration:plan --name make-project-link-optional` and review the generated migration (drops NOT NULL on `cases.project_link`, nothing else); ask the user to run `db:migrate` and `db:verify` (denied for Claude)

## 3. Responses

- [x] 3.1 Red: in `src/case/dto/case-serialization.spec.ts` add tests that the list item, detail and full view serialize `projectLink: null` as `null` and keep the key
- [x] 3.2 Green: in `src/case/dto/case-list-item.dto.ts` change to `projectLink!: string | null` with `@ApiProperty({ type: String, nullable: true, ... })` and a description that it is `null` without a link
- [x] 3.3 Red: in `src/case/dto/case-swagger-types.spec.ts` (if it lists nullable fields) add `projectLink` for the three response DTOs; keep it green with 3.2 (skipped: that spec only checks lazy `type()` references of DTO classes, nullability is covered by 3.1 and 5.1)

## 4. HTTP behavior (e2e, real local DB)

- [ ] 4.1 Red: in `test/case-management.e2e-spec.ts` add scenarios "Create with required fields only" (no `projectLink`, response `projectLink: null`), "Create a published case without a link", "Empty link" (`400`), "Add a link to a case without one" and "Link is untouched by an unrelated update"; run them red
- [ ] 4.2 Green: confirm 1.2 and 2.2 make them pass (the DB must already have the migration from 2.3); fix the code if not
- [ ] 4.3 Red then green: in `test/case-catalog.e2e-spec.ts` add "Case without a link" for the list and extend "Optional fields are null, not omitted" for the detail with `projectLink`; update existing e2e files that build a case (`case-image`, `case-background`) only if the types require it

## 5. Swagger

- [x] 5.1 Red: in `test/api-docs.e2e-spec.ts` remove `projectLink` from `CREATE_REQUIRED`, assert `CreateCaseDto.projectLink.maxLength` is 100, and assert `projectLink` is `string` with `nullable: true` and required in `CaseListItemDto`, `CaseDetailDto` and `CaseFullDto`; run it red
- [x] 5.2 Green: confirm the DTO decorators from 1.2 and 3.2 produce that document; fix the decorators if not

## 6. Docs and final check

- [x] 6.1 Search `README.md` and `CLAUDE.md` for statements that `projectLink` is required and update them in the same change (skip with a note if there are none) (none found, nothing to update)
- [ ] 6.2 Run `pnpm run check` (typecheck, lint, unit tests) and `pnpm run test:e2e --runInBand` against the migrated local DB; everything green
