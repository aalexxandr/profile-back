## 1. Data model

- [x] 1.1 Add `backgroundImageKey` (`background_image_key`) and `backgroundBlurImage` (`background_blur_image`), both nullable, to `Case` in `prisma/contract.prisma`; run `pnpm run db:generate`
- [x] 1.2 Ask the user to create and apply the additive migration (`db:migration:plan --name add_case_background` → `db:migrate` → `db:verify`); the agent does not run DB-mutating commands

## 2. Slot helpers

- [x] 2.1 Red: unit spec `src/case/case-image.util.spec.ts` for the S3 key per slot (`cases/<slug>/<hash>.webp` and `cases/<slug>/background/<hash>.webp`) and the column names per slot
- [x] 2.2 Add `CaseImageSlot` to `case.types.ts`, the slot map to `case.constants.ts` and `case-image.util.ts` to green

## 3. Service

- [x] 3.1 Red: extend `case.service.spec.ts` with the background cases (`setPicture`/`removePicture` for `'background'`: 404 before work, put then update, discard new object on update failure, previous background removed, `image` columns untouched, repeat delete is a no-op) and `deleteCase` removing both objects
- [x] 3.2 Refactor `setImage` / `removeImage` into slot-based `setPicture` / `removePicture` and add background wrappers; extend `deleteCase`; existing image tests stay green

## 4. Response shape

- [x] 4.1 Red: extend `dto/case-serialization.spec.ts` and `case.fixtures.ts`: detail and full view contain `backgroundImage` / `backgroundBlurImage`, list item does not, no key leaks
- [x] 4.2 Add the fields to `CaseView` / `CaseFullView`, `toView` / `toAdminView`, and to `CaseDetailDto` / `CaseFullDto` with `@Expose()` and `@ApiProperty` (nullable, description, example)

## 5. Routes and Swagger

- [x] 5.1 Red: new `test/case-background.e2e-spec.ts` covering the `case-background-image` scenarios (upload, draft, independence from `image`, replace, same file twice, 404, missing file 400, invalid/corrupt 400, over 10 MB 413, 401 without and with a wrong token, delete, repeat delete, delete unknown 404)
- [x] 5.2 Add `PUT` / `DELETE /cases/:slug/background` to the controller with `@ApiOperation`, `@ApiParam`, `@ApiConsumes`, `@ApiBody`, responses, `@ApiErrorResponse` and `@ApiAdminAuth()`; run the e2e to green
- [x] 5.3 Red then green: add background scenarios to `test/api-docs.e2e-spec.ts` (multipart `file`, `200` / `204`, error statuses, nullable background fields on detail and full DTO, none on list/create/update DTOs, no key)
- [x] 5.4 Red then green: extend `test/case-catalog.e2e-spec.ts` (detail with and without background, list without it) and `test/case-management.e2e-spec.ts` (full view fields, JSON bodies reject background fields, delete case removes the background object)

## 6. Docs

- [x] 6.1 Update root `CLAUDE.md`, `src/case/CLAUDE.md` and `README.md` (new routes, columns, key prefix, slot rule)

## 7. Final check

- [x] 7.1 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (migration applied), fix anything red
