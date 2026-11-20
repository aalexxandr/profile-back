# Design

## Context

The background was added by `add-case-background-image` as a second "slot" of the picture flow: `CaseImageSlot = 'image' | 'background'` (`case.types.ts`), `IMAGE_SLOTS` (`case.constants.ts`: key column, blur column, S3 folder per slot), `pictureKey(slug, slot, bytes)` / `pictureColumns(slot, key, blur)` (`case-image.util.ts`), and the private `setPicture` / `removePicture` in `CaseService` behind `setImage` / `setBackground` / `removeImage` / `removeBackground`. The fields reach clients through `CaseDetailDto` (and `CaseFullDto` by inheritance via `OmitType`); `CaseView` / `CaseFullView` carry `backgroundImage`. Columns live in `prisma/contract.prisma`; migration `20261021T0833_add_case_background` added them.

The Prisma 8 runtime checks on first query that the database marker matches the contract's storage hash (`verifyMarker: 'onFirstUse'` by default), so code and schema must move together.

## Goals / Non-Goals

**Goals:**

- No trace of the background in the HTTP API, the Swagger document, the code, the contract or the database schema.
- The picture (`image` / `blurImage`) keeps exactly its current behavior and S3 key format `cases/<slug>/<hash>.webp`, so existing picture objects stay valid.

**Non-Goals:**

- Deleting leftover background objects from the bucket (manual, documented in README).
- Rewriting or squashing the old migration `add_case_background`; migration history is append-only.
- Changing the picture flow's order or error handling.

## Decisions

1. **Drop the columns with a new migration.** Remove `backgroundImageKey` / `backgroundBlurImage` from `Case` in `prisma/contract.prisma`, `pnpm run db:generate`, then `db:migration:plan --name drop_case_background` (writes `migrations/app/<ts>_drop_case_background/` with two `dropColumn` operations; review that it drops only those two). The user applies it (`db:migrate` → `db:verify`); the agent does not run DB-mutating commands. Alternative rejected: keeping the columns unused (user chose to drop; dead data in the schema).

2. **Remove the slot abstraction instead of leaving a one-element slot map.** With a single picture, `CaseImageSlot`, `IMAGE_SLOTS` and `pictureColumns` add indirection for nothing. `pictureKey(slug, bytes)` stays in `case-image.util.ts` (pure, tested) and returns the unchanged `cases/<slug>/<hash>.webp`. `setPicture` / `removePicture` fold back into `setImage` / `removeImage` with the same order (404 → process → read translations → put → update → discard on failure → delete previous); the update writes `{ imageKey, blurImage }` directly. Alternative rejected: keep the slot machinery for a hypothetical future picture (YAGNI; easy to re-introduce from git history).

3. **Routes disappear, no stub.** `setBackground` / `removeBackground` and their controller methods, `BACKGROUND_UPLOAD_BODY` are deleted. An unmatched route is answered `404` by Nest's router before guards run, so a request with or without a token gets `404` and `FileInterceptor` never sees the body. Alternative rejected: a `410 Gone` stub (keeps the operation in `/docs-json`, which is exactly what the frontend must lose).

4. **Response shape.** Remove the two properties from `CaseDetailDto`; `CaseFullDto` loses them through inheritance. Remove `backgroundImage` from `CaseView` / `CaseFullView` and `toView` / `toAdminView`. `excludeAll` serialization already guarantees nothing un-`@Expose()`d leaks.

5. **`deleteCase` removes only `imageKey`.** Leftover background objects are not touched: the row no longer knows their keys, and listing the bucket by prefix would add an S3 call (and a new storage method) for a one-off cleanup.

6. **Delete `test/case-background.e2e-spec.ts` whole.** Its behaviors are replaced by the "Cases have no background routes" scenarios in `case-management`.

### Test levels

| Behavior (spec scenario)                                                                                      | Level       | Where                                     | Mocks                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Picture key format unchanged, no slot argument                                                                | unit        | `src/case/case-image.util.spec.ts`        | none                                                                         |
| `setImage` writes only `imageKey` / `blurImage`; `deleteCase` deletes only the picture object                 | unit        | `src/case/case.service.spec.ts`           | `PrismaService`, `StorageService`, `ImageProcessingService` (existing mocks) |
| Detail / full view never expose `backgroundImage` / `backgroundBlurImage`, even if the source object has them | unit        | `src/case/dto/case-serialization.spec.ts` | none                                                                         |
| Detail of a case with a background (left-over object), list has no background fields                          | e2e (DB)    | `test/case-catalog.e2e-spec.ts`           | `InMemoryStorage` (pre-seeded leftover object)                               |
| Full view has no background fields; `PATCH` with `backgroundImage` → `400`; delete leaves the leftover object | e2e (DB)    | `test/case-management.e2e-spec.ts`        | `InMemoryStorage`                                                            |
| `PUT` / `DELETE /cases/:slug/background` → `404` with token, storage and picture untouched                    | e2e (DB)    | `test/case-management.e2e-spec.ts`        | `InMemoryStorage`                                                            |
| No `/background` path, no background properties, `504` only on the picture upload                             | e2e (no DB) | `test/api-docs.e2e-spec.ts`               | none                                                                         |

Most of this is removal: the red step is a new or flipped assertion ("has no `backgroundImage`", "answers `404`") that fails against the current code, then the code is removed. Pure deletions of tests whose behavior is gone (the background service specs, the slot specs, `case-background.e2e-spec.ts`) need no red step.

## Risks / Trade-offs

- [Data loss: background keys and placeholders are dropped] → Intended; the user confirmed. Rollback of the code alone does not bring the data back.
- [Code and schema must switch together: the runtime refuses to query a DB whose marker does not match the contract] → Apply the migration right before starting the new build; locally, e2e with the DB runs only after the user applies it.
- [Orphaned objects under `cases/*/background/` keep costing storage] → README documents a one-off manual prefix delete; objects are small WebPs.
- [Overlap with the in-progress `make-project-link-optional`, which also modifies `case-catalog` "Return case detail by slug"] → Whichever change is archived second must merge both edits (nullable `projectLink` wording + background removal) into its MODIFIED block before archiving.
- [The `case-background-image` main spec becomes empty after archive] → Delete `openspec/specs/case-background-image/` during archive.

## Migration Plan

1. Implement and merge the change (code, contract, generated migration, docs).
2. User: `pnpm run db:migrate` then `pnpm run db:verify` against the target DB, immediately followed by deploying the new build.
3. Frontend regenerates its types from `/docs-json`.
4. Operator removes `cases/*/background/` objects from the bucket (README step).

Rollback: redeploy the previous build together with a migration that re-adds the two nullable columns (values stay `null`).
