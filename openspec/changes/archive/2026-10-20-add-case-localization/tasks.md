# Tasks

## 1. Locale primitives and spike

- [x] 1.1 Red test: `src/case/case-locale.util.spec.ts` for `resolveLocale` (`'en'` -> `en`; `undefined`, `''`, `'ru'`, `'de'`, `'EN'`, an array -> `ru`); run it and confirm it fails because the module is missing
- [x] 1.2 Add `Locale` (a string union in `case.types.ts` for now; it becomes the generated enum in 2.1), `DEFAULT_LOCALE` to `case.constants.ts` and `resolveLocale` in `src/case/case-locale.util.ts`; the spec from 1.1 is green
- [x] 1.3 Spike (throwaway, nothing committed): against the Prisma 8 RC contract confirm how to (a) declare the `case_translations` model with a composite primary key, a foreign key with cascade delete and an `Achievement[]` column, (b) load a case with its translations, (c) run several writes in one transaction, (d) express a data step (copy + unpublish) in a migration. Record the findings in `design.md` under the matching decision and adjust the following groups if (b) or (c) is unavailable

## 2. Schema and migration (the user applies it)

- [x] 2.1 Add `native_enum Locale` and `model CaseTranslation` (`@@map("case_translations")`, `UNIQUE(case_slug, locale)`, cascade) to `prisma/contract.prisma`, remove the text columns from `Case`, add the `caseTranslations` getter to `PrismaService`; verify `pnpm run db:generate` and `pnpm run typecheck` show only the expected errors in `src/case`
- [x] 2.2 Ask the user to run `pnpm run db:migration:plan --name add-case-translations`, then author the data step in the generated migration so that the order is: create table and enum, copy the five text columns into `ru` rows, `UPDATE cases SET published = false`, drop the old columns; verify by reading `migrations/` and by the user's manual run on a copy of the data (a published case ends up with a `ru` translation, no `en` and `published = false`); the agent does not run `db:migrate`

## 3. Request DTOs and validation

- [x] 3.1 Red tests: update `create-case.dto.spec.ts` and `update-case.dto.spec.ts` for the new shapes (`translations.ru` required, `en` optional but complete, length limits per field, unknown locale `de`, old top-level `name` rejected, up to 10 achievements, empty `translations` rejected, update accepts a partial `en` and a partial `ru`, `slug` still rejected); confirm they fail for the right reason
- [x] 3.2 Implement `CaseTranslationDto` (moved text fields with their limits and `@ApiProperty`), `CreateCaseTranslationsDto`, `UpdateCaseTranslationsDto`, and rewire `CreateCaseDto` / `UpdateCaseDto`; one class per file in `dto/`; the specs from 3.1 are green

## 4. Response DTOs and serialization

- [x] 4.1 Red tests: extend `case-serialization.spec.ts` (public list and detail have `locale` and no `translations`, `published`, `sortOrder`; `CaseFullDto` has `translations.ru`, `translations.en` possibly `null`, `published`, `sortOrder`, no `locale` and no storage key)
- [x] 4.2 Add `locale` to `CaseListItemDto`, create `CaseFullDto` (and the translation response DTO), add `FULL` to `case.constants.ts`, update `case.types.ts` (`CaseView`, `CaseFullView`); the serialization spec is green

## 5. Service: reads, writes, publish rule

- [x] 5.1 Red tests in `case.service.spec.ts` for reads: the requested translation is returned with `locale`; the `ru` row is used and `locale` is `ru` when the requested row is missing; list order is unchanged
- [x] 5.2 Implement the read path (`findAll(locale)`, `findBySlug(slug, locale)`) per the spike result; the read tests are green
- [x] 5.3 Red tests for create: case and translations written together; `published: true` without `en` throws `BadRequestException` and writes nothing; a duplicate slug is not caught (propagates)
- [x] 5.4 Implement `createCase` returning the full view; the create tests are green
- [x] 5.5 Red tests for update: per-field merge inside one locale, `achievements` replaced as a whole, a complete new `en` is created, a partial new `en` throws `BadRequestException`, `published: true` on a case without `en` throws, `published: true` together with a complete `en` succeeds, other fields untouched, unknown slug throws `NotFoundException`
- [x] 5.6 Implement `updateCase` (merge in one transaction, publish rule on the resulting state) returning the full view; `setImage` returns the full view too; the update and image tests are green
- [x] 5.7 Add a service test that deleting a case leaves no translation rows to read (cascade is verified in e2e in 7.2); keep `deleteCase` unchanged apart from what the schema requires

## 6. Controller, query parameter and Swagger

- [x] 6.1 Red e2e tests in `test/api-docs.e2e-spec.ts` (no DB): `lang` query parameter on the two public reads only (enum, default `ru`, description), `locale` in the public schemas, `CaseFullDto` as the `201` / `200` schema of `POST`, `PATCH` and `PUT /image` with nullable `ru` / `en`, no `name` on `CaseFullDto`, translation schema properties with descriptions and examples, `CreateCaseDto` without the old text properties, `UpdateCaseDto.translations` with no required properties, no empty schemas, every `$ref` resolves
- [x] 6.2 Update `case.controller.ts`: `@Query('lang')` through `resolveLocale` on the two public reads with `@ApiQuery`, write routes serialized with `FULL` and documented with `CaseFullDto`, operation descriptions mention languages, the publish rule and the `400`; update the tag / document description in `swagger.config.ts` if it mentions text fields; the api-docs e2e is green

## 7. End-to-end behavior

- [x] 7.1 Red e2e tests in `test/case-catalog.e2e-spec.ts`: `?lang=en` and `?lang=ru`, no `lang`, `?lang=de`, `Accept-Language` ignored, `locale` on list and detail, compact list keys, drafts hidden; update helpers and fixtures in `test/helpers` / `case.fixtures.ts` as needed (unique data, deleted afterwards)
- [x] 7.2 Red e2e tests in `test/case-management.e2e-spec.ts`: create with `ru` only (draft) and with both, `published: true` without `en` -> `400` and nothing stored, `PATCH` publish without `en` -> `400`, `PATCH` adds `en` and publishes, merge of one field, partial new locale -> `400`, unknown locale and old flat fields -> `400`, duplicate slug -> `409` with the old translations intact, delete removes translations (recreating the slug gives `translations.en: null`), `401` cases with the new body shapes
- [x] 7.3 Update `test/case-image.e2e-spec.ts` so upload returns the full view (`translations` present); then make 7.1-7.3 green with the implementation from groups 4-6, fixing only what the tests show
- [x] 7.4 Confirm `test/admin-auth.e2e-spec.ts` and `test/app-setup.e2e-spec.ts` still pass with the new body shapes and update their request bodies if needed

## 8. Documentation and final checks

- [x] 8.1 Update `CLAUDE.md` (Architecture, Prisma notes, Swagger section if the DTO names changed), `src/case/CLAUDE.md` (translations, view types, merge and publish rules, the data migration note) and `README.md` (Russian: `?lang=`, `translations` body, migration unpublishes existing cases); verify by reading them against the code
- [x] 8.2 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (the latter needs the user to have applied the migration to the local DB); both are green, and any skipped test is explained in the final message
- [x] 8.3 Check that every scenario of the five delta specs is covered by a test, as required before archiving

## Workflow follow-up

- Ask the user to apply the migration to the local database, run the e2e suite, and then to production after backing it up.
- After deploy, fill the `en` translation of each case through `PATCH /cases/:slug` and re-publish.
- Archive the change after the project's review requirements are satisfied.
