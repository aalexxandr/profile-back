# Tasks

The contract (`prisma/contract.prisma`) changes last (group 4): until then the DB still has the columns and e2e tests with the DB run against the current schema. After group 4 the e2e tests with the DB need the user to apply the migration first.

## 1. Background routes are gone

- [x] 1.1 Red: in `test/case-management.e2e-spec.ts` add the "Cases have no background routes" scenarios: `PUT /cases/<slug>/background` with a valid JPEG in `file` and `adminAuth()` → `404` and `InMemoryStorage.keys()` unchanged; `DELETE /cases/<slug>/background` with `adminAuth()` on a case with a picture → `404` and `image` / `blurImage` unchanged. Run `pnpm run test:e2e --runInBand -- case-management` and confirm they fail with `200` / `204`, not a compile error
- [x] 1.2 Red: in `test/api-docs.e2e-spec.ts` remove both `/cases/{slug}/background` rows from `OPERATIONS`, `ADMIN_RESPONSES` and the `504` / admin-auth lists, replace the `case background` describe with "Document has no case background" (`paths` has no `/cases/{slug}/background`) and assert `PUT /cases/{slug}/image` is the only operation documenting `504`. Run `pnpm run test:e2e -- api-docs` and confirm the new assertions fail
- [x] 1.3 Green: delete `setBackground` / `removeBackground` from `case.controller.ts` and `case.service.ts`, `BACKGROUND_UPLOAD_BODY` from `case.constants.ts`, their unit tests in `case.service.spec.ts` (`describe('setBackground')`, `describe('removeBackground')`) and `'setBackground'` in `dto/case-serialization.spec.ts`; delete `test/case-background.e2e-spec.ts`. Verify 1.1 and 1.2 are green and `pnpm test` passes
- [x] 1.4 Docs: remove the two background routes from the README route table and the background routes sentence from the "Architecture" section of root `CLAUDE.md`; verify `grep -n "/background" README.md CLAUDE.md` finds only the manual cleanup note added in 4.4 (none yet)

## 2. Responses have no background fields

- [x] 2.1 Red: in `src/case/dto/case-serialization.spec.ts` flip the background tests: the detail and the full view, given an object with `backgroundImage`, `backgroundBlurImage` and `backgroundImageKey`, contain none of them; remove `backgroundImage` / `backgroundBlurImage` from the expected detail/full key lists. Run `pnpm test -- case-serialization` and confirm it fails because the fields are still sent
- [x] 2.2 Red: in `test/api-docs.e2e-spec.ts` assert no schema in `components.schemas` (incl. `CaseDetailDto`, `CaseFullDto`) has `backgroundImage`, `backgroundBlurImage` or `backgroundImageKey`, and drop them from `ADMIN_FIELDS`. Run `pnpm run test:e2e -- api-docs` and confirm red
- [x] 2.3 Red: in `test/case-catalog.e2e-spec.ts` replace "returns the absolute background URL" with "Detail of a case with a background" (seed `InMemoryStorage` with `cases/<slug>/background/cd34ef56ab78ab12.webp`, detail has no background fields), drop the background keys from the detail key list and the `null` expectations, keep "List has no background fields" without writing background columns; in `test/case-management.e2e-spec.ts` assert `POST /cases` returns no `backgroundImage` / `backgroundBlurImage` (keep the `PATCH { backgroundImage } → 400` test). Run both e2e files and confirm red
- [x] 2.4 Green: remove `backgroundImage` / `backgroundBlurImage` from `CaseDetailDto` (with their `@ApiProperty`), `backgroundImage` from `CaseView` / `CaseFullView` and from `toView` / `toAdminView`, and from `caseView` / full-view fixtures in `case.fixtures.ts`. Verify 2.1–2.3 green and `pnpm test` passes
- [x] 2.5 Docs: README `GET /cases/:slug` row lists no background fields; verify by reading the row

## 3. Single picture flow

- [x] 3.1 Red: rewrite `src/case/case-image.util.spec.ts` for `pictureKey(slug, bytes)` → `cases/<slug>/<sha256 prefix 16>.webp` (same bytes same key, other bytes other key); drop the `IMAGE_SLOTS` and `pictureColumns` specs. Run `pnpm test -- case-image.util` and confirm it fails on the old signature (runtime, not only a type error: call with two args and assert the exact key)
- [x] 3.2 Red: in `src/case/case.service.spec.ts` make `deleteCase` tests assert only the picture object is deleted even when the row carries a `backgroundImageKey` (one `storage.delete` call), and drop the "deletes the background" tests. Run `pnpm test -- case.service` and confirm red
- [x] 3.3 Green + refactor: remove `CaseImageSlot` (`case.types.ts`), `IMAGE_SLOTS` (`case.constants.ts`) and `pictureColumns`; change `pictureKey` to `(slug, bytes)`; fold `setPicture` / `removePicture` into `setImage` / `removeImage` keeping the exact order and writing `{ imageKey, blurImage }`; `deleteCase` removes only `imageKey`. Verify all `setImage` / `removeImage` / `deleteCase` unit tests and `test/case-image.e2e-spec.ts` are green
- [x] 3.4 Docs: in `src/case/CLAUDE.md` delete the "Background" bullet and make the "Pictures" bullet describe `setImage` / `removeImage` directly; verify `grep -n -i background src/case/CLAUDE.md` is empty

## 4. Contract and migration

- [x] 4.1 Remove `backgroundImageKey` / `backgroundBlurImage` from `Case` in `prisma/contract.prisma`, run `pnpm run db:generate`, remove both fields from `caseRow` in `case.fixtures.ts` and any remaining row literals in specs/e2e (`case-catalog`, `case-management`); verify `pnpm run typecheck` passes and `grep -rn -i "background" src test --include=*.ts` finds only the leftover-object scenarios and the docs assertions
- [x] 4.2 Run `pnpm run db:migration:plan --name drop_case_background`; verify the generated `migrations/app/<ts>_drop_case_background/` contains exactly two `dropColumn` operations on `public.cases` (`background_image_key`, `background_blur_image`) and nothing else
- [x] 4.3 Ask the user to run `pnpm run db:migrate` and `pnpm run db:verify` on the local DB (the agent does not run DB-mutating commands); verify with them that `db:verify` reports no drift
- [x] 4.4 Docs: root `CLAUDE.md` and README drop the background columns, S3 key prefix and response fields from the image/architecture text; README gets a one-off step "remove the `cases/*/background/` objects from the bucket by hand" and the migration note (apply right before deploying); verify `grep -n -i background CLAUDE.md README.md` shows only that step

## 5. Final check

- [x] 5.1 Run `pnpm run test:e2e --runInBand` (migration applied) and verify all e2e suites are green
- [x] 5.2 Run `openspec validate remove-case-background --strict` and verify it is valid
- [x] 5.3 Run `pnpm run check` and verify typecheck, lint and unit tests are green

## Workflow follow-up

- Before archiving: if `make-project-link-optional` is archived first, merge its `projectLink` wording into this change's MODIFIED "Return case detail by slug" (`case-catalog`), and vice versa.
- At archive: delete the emptied `openspec/specs/case-background-image/`.
- After deploy: the frontend regenerates its types from `/docs-json`; the operator cleans the bucket prefix.
