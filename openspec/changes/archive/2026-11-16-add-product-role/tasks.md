## 1. Validation (unit)

- [x] 1.1 Red test in `src/case/dto/create-case.dto.spec.ts`: `role: 'PRODUCT'` is valid; `'BACKEND'`, `'product'` and `'Product Engineer'` are rejected; run it and confirm it fails because `PRODUCT` is rejected
- [x] 1.2 Add `PRODUCT = "PRODUCT"` to `native_enum Role` in `prisma/contract.prisma`, run `pnpm run db:generate`, make 1.1 green

## 2. Swagger (e2e without DB)

- [x] 2.1 Red test in `test/api-docs.e2e-spec.ts`: update the existing `role` enum expectation to `FRONTEND`, `FULLSTACK`, `PRODUCT` and add the same check for `UpdateCaseDto` and `CaseDetailDto` (scenario "Role enum is the same in every schema")
- [x] 2.2 Make it green; if needed, mention the three values in the `description` of the `role` `@ApiProperty` in `create-case.dto.ts` and `case-detail.dto.ts`, and the `400` description in the controller

## 3. HTTP behavior (e2e with DB)

- [x] 3.1 Red tests in `test/case-management.e2e-spec.ts`: create with `PRODUCT` returns `201` and `role: 'PRODUCT'`; `PATCH` from `FRONTEND` to `PRODUCT` returns `200` with other fields unchanged; create and `PATCH` with `BACKEND` return `400` and the stored role is unchanged; `FRONTEND` and `FULLSTACK` still work
- [x] 3.2 Red test in `test/case-catalog.e2e-spec.ts`: a published case with `role: 'PRODUCT'` is returned by `GET /cases/:slug` with `role: 'PRODUCT'`
- [x] 3.3 Make 3.1 and 3.2 green (no service code change expected, `CaseService` passes `role` through); this needs the migration from section 4 applied to the local DB

## 4. Migration

- [x] 4.1 Ask the user to run `pnpm run db:migration:plan --name add_product_role`, then `db:migrate` and `db:verify` (these commands are denied to Claude); review the generated `migrations/app/*_add_product_role` and its snapshot, and commit them
- [x] 4.2 Run the e2e tests of section 3 against the migrated local DB

## 5. Docs and summary

- [x] 5.1 Check `README.md`, `CLAUDE.md` and `src/case/CLAUDE.md` for lists of role values and update them if any (none found so far)
- [x] 5.2 Write the short frontend summary in Russian: accepted values (`FRONTEND`, `FULLSTACK`, `PRODUCT`, uppercase, exact), `PRODUCT` is shown as "Product Engineer" by the frontend, where the field appears (`POST` / `PATCH` body, `GET /cases/:slug`, full view; not in the `GET /cases` list), `400` on anything else, regenerate types from `/docs-json` and handle the new union member
- [x] 5.3 Run `pnpm run check` and make it green
