# Proposal

## Why

The frontend no longer shows a background on the case page, so the case background (`backgroundImage` / `backgroundBlurImage`) is leaving the product. The backend is the source of the API contract: the frontend regenerates its types from `/docs-json`, so the fields and routes must disappear here first for the background to drop out of the frontend's `schema.d.ts`.

## What Changes

- **BREAKING** Remove the routes `PUT /cases/:slug/background` and `DELETE /cases/:slug/background`; they answer `404` like any unknown route.
- **BREAKING** Remove `backgroundImage` and `backgroundBlurImage` from the detail view (`GET /cases/:slug`, `CaseDetailDto`) and the full view (`POST`, `PATCH`, `PUT /cases/:slug/image`, `CaseFullDto`).
- Remove both operations, the background upload body and both properties from the Swagger document (`/docs-json`).
- Drop the columns `background_image_key` and `background_blur_image` from `cases` with a new Prisma migration (`drop_case_background`); the stored values are discarded.
- `DELETE /cases/:slug` removes only the stored picture; the background slot no longer exists.
- Collapse the two-slot picture flow in `CaseService` (`CaseImageSlot`, `IMAGE_SLOTS`) back to the single picture where it no longer pays off.
- Existing background objects in the bucket (`cases/<slug>/background/*.webp`) are **not** removed by code: the README gets a one-off manual cleanup step for the operator.
- Update `CLAUDE.md`, `src/case/CLAUDE.md` and `README.md`.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `case-background-image`: every requirement is removed; the capability ceases to exist.
- `case-catalog`: the detail view no longer has `backgroundImage` / `backgroundBlurImage`.
- `case-management`: the full view no longer has the background fields, deleting a case no longer removes a background object, and the background routes are gone.
- `api-documentation`: the background operations, upload body and response fields are removed from the document; `504` is documented only for the picture upload.

## Impact

- API (breaking for clients): two routes and two response fields removed. The only client is the portfolio frontend, which already stopped using them and will regenerate its types.
- Database: migration dropping two nullable columns of `cases`; must be applied by the user (`db:migration:plan` → `db:migrate` → `db:verify`) together with the deploy, because the runtime checks on first query that the database matches the contract. Irreversible for the data.
- Storage: leftover objects under `cases/*/background/` stay in the bucket until removed by hand.
- Code: `src/case/` (controller, service, constants, types, `case-image.util.ts`, `dto/case-detail.dto.ts`, fixtures), `prisma/contract.prisma`, `migrations/`.
- Tests: `test/case-background.e2e-spec.ts` deleted; `test/api-docs.e2e-spec.ts`, `test/case-catalog.e2e-spec.ts`, `test/case-management.e2e-spec.ts`, `src/case/case.service.spec.ts`, `src/case/case-image.util.spec.ts`, `src/case/dto/case-serialization.spec.ts` updated.
- Overlap: the in-progress change `make-project-link-optional` also modifies `case-catalog` "Return case detail by slug"; whichever change is archived second must carry both edits.
