# Proposal

## Why

A case page needs a large background picture next to the existing case picture. Today a case has only one picture (`image` / `blurImage`), so the frontend has nowhere to get a background and its blur placeholder from.

## What Changes

- Add a second, independent picture to a case: the background. The file lives in the S3 bucket, the blur placeholder lives in the database, and both are produced in code from one uploaded file, exactly like the case picture.
- New routes `PUT /cases/:slug/background` (multipart, one `file`) and `DELETE /cases/:slug/background`, admin only. The existing `/image` routes and their contract do not change.
- New response fields `backgroundImage` (absolute URL) and `backgroundBlurImage` (`data:image/webp;base64,...`), both `null` without a background. They appear in `GET /cases/:slug` and in the full (admin) view; they are **not** added to `GET /cases`. The storage key stays internal.
- Deleting a case removes the background object from the storage as well.
- Two nullable columns on `cases`: `background_image_key`, `background_blur_image` (additive migration, no backfill).
- Swagger documentation, tests, `CLAUDE.md` files and README are updated.

No **BREAKING** changes: existing fields, routes and limits stay as they are.

## Capabilities

### New Capabilities

- `case-background-image`: uploading, replacing and removing the background picture of a case, its processing (WebP, blur placeholder) and storage rules.

### Modified Capabilities

- `case-catalog`: the detail view of a case gains `backgroundImage` and `backgroundBlurImage`.
- `case-management`: the full view gains the same two fields; deleting a case also removes its background object.
- `api-documentation`: the background routes and fields must be documented in the generated Swagger document.

## Impact

- Code: `prisma/contract.prisma`, `src/case/` (controller, service, DTOs, constants, types), a shared helper for the "store, save row, clean up" picture flow, `src/prisma/` generated contract (not committed).
- API: two new admin routes, two new response fields on the detail and full views.
- Database: one additive migration, applied by the user with `db:migrate`.
- Storage: new objects under `cases/<slug>/background/`.
- Reused unchanged: `ImageProcessingService`, `StorageService`, `InMemoryStorage` in tests.
- Docs: `CLAUDE.md`, `src/case/CLAUDE.md`, `README.md`.
