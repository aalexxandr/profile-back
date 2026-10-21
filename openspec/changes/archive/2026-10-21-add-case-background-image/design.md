## Context

A case has one picture: `PUT/DELETE /cases/:slug/image`, DB columns `image_key` + `blur_image`, S3 key `cases/<slug>/<hash>.webp`. `CaseService.setImage/removeImage/deleteCase` implement the "store → save row → clean up" flow inline, and `ImageProcessingService.process()` already returns `{ image, blur }`. The background is a second, independent picture with the same technical shape.

## Goals / Non-Goals

**Goals**

- A second picture slot on a case (background) with its own routes, columns and response fields.
- No duplication of the store/save/clean-up flow and no change to the existing `/image` contract.

**Non-Goals**

- Putting both files into one request or one route (decided against: it would change the `/image` contract and complicate `DELETE`).
- Different size limits or processing for the background (same 1920 px, 10 MB, `process()` unchanged).
- Showing the background in `GET /cases` (list stays compact).
- Any backfill: existing cases simply have `null` background.

## Decisions

1. **Data model.** `Case` gets `backgroundImageKey String? @map("background_image_key")` and `backgroundBlurImage String? @map("background_blur_image")`. Additive migration `add_case_background`, applied by the user with `db:migrate`; the agent only writes the contract and runs `db:generate`.
2. **Routes.** `PUT /cases/:slug/background` (`FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } })`, `204`-style `DELETE`) next to the `/image` routes, both with `@ApiAdminAuth()`. Rejected: one shared route with a `background` field (contract change, DELETE selector).
3. **Slot abstraction.** Introduce `CaseImageSlot = 'image' | 'background'` in `case.types.ts` and a constant map in `case.constants.ts` giving, per slot, the key column (`imageKey` / `backgroundImageKey`), the blur column (`blurImage` / `backgroundBlurImage`) and the S3 key prefix (`cases/<slug>/` / `cases/<slug>/background/`). `setImage` and `removeImage` become thin wrappers around `setPicture(slug, file, slot)` / `removePicture(slug, slot)`, keeping the exact existing order (404 before work → process → put → update → discard-on-failure → delete previous). Pure key building goes to `case-image.util.ts` (own spec); the class files keep only the class. The controller adds two methods that call the same service methods with `'background'`.
4. **Delete case.** `deleteCase` removes both `imageKey` and `backgroundImageKey` objects (best effort, existing `removeObject`).
5. **Views.** `CaseView` / `CaseFullView` gain `backgroundImage: string | null` built with the existing `imageUrl()`. `CaseDetailDto` and `CaseFullDto` get `backgroundImage` / `backgroundBlurImage` with `@Expose()` and `@ApiProperty({ nullable: true, description, example })`. `CaseListItemDto` is untouched, so `excludeAll` keeps them out of the list; keys stay without `@Expose()`.
6. **PrismaService** needs no new getter (same model).
7. **Docs.** Update root `CLAUDE.md` (architecture paragraph on pictures), `src/case/CLAUDE.md` (slot rule, key prefixes), `README.md`, and the Swagger texts of the controller.

## Test levels

| Behavior                                                                                                               | Level                                                                                                                 | Mock                                                               |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Slot key/prefix building (`case-image.util.ts`)                                                                        | unit                                                                                                                  | none                                                               |
| `setPicture` / `removePicture` per slot: order, discard on failure, previous object removal, `deleteCase` removes both | unit (`case.service.spec.ts`)                                                                                         | `PrismaService`, `StorageService`, `ImageProcessingService`        |
| Response shape: background fields in detail and full view, absent in list                                              | unit (`case-serialization.spec.ts`)                                                                                   | none                                                               |
| Swagger schemas and operations                                                                                         | e2e without DB (`test/api-docs.e2e-spec.ts`)                                                                          | none                                                               |
| Upload / replace / delete / 400 / 401 / 404 / 413 over HTTP, independence from `image`, delete case removes both       | e2e with DB (`test/case-background.e2e-spec.ts`, `test/case-management.e2e-spec.ts`, `test/case-catalog.e2e-spec.ts`) | `StorageService` replaced by `InMemoryStorage` via `createTestApp` |

## Risks / Trade-offs

- Refactoring the working image flow into slots risks a regression in `/image`; mitigated by running the existing image tests green before and after the refactor and by keeping the order identical.
- Two pictures raise payload size of the detail response (one more data-URI of about 1 KB); acceptable, and the list is unaffected.
- Orphaned objects after a failed cleanup are possible, as today (best effort by design).
- Migration is applied by the user; until then `db:generate` output and the DB disagree, so tasks end with a note to run `db:migrate` before e2e.
