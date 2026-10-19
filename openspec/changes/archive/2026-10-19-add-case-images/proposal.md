# Proposal

## Why

Cases have no picture, so the frontend has nothing to show on the list and detail pages. A full-size image alone makes pages feel slow while it loads, so the frontend also needs a tiny blurred placeholder to show instantly. The author wants to upload one ordinary image and have the placeholder produced automatically. The portfolio's Selectel S3 bucket `portfolio` exists but is not connected to the project yet.

## What Changes

- Connect Selectel S3 (bucket `portfolio`, public read) to the backend through a new storage module, configured by environment variables.
- Add `PUT /cases/:slug/image` (multipart, a single `file`) that validates the upload, re-encodes it to a real WebP no wider than 1920 px with metadata stripped, uploads it to S3 and builds a ~20 px blurred WebP placeholder.
- Add `DELETE /cases/:slug/image` that clears the picture of a case.
- Store the S3 object key and the placeholder (a base64 `data:` URI) on the case; both are nullable, so cases without a picture and existing rows stay valid.
- Expose `image` (absolute public URL, or `null`) and `blurImage` (data URI, or `null`) in the list item and the detail view of a case.
- Replacing a picture, clearing it, or deleting the case removes the previous S3 object.
- Publishing a case without a picture stays allowed.
- `POST /cases` and `PATCH /cases/:slug` stay JSON and unchanged; the image fields are not accepted there.
- Swagger documents the new operations (multipart body, error statuses) and the new response fields; tests prove it.
- Update `CLAUDE.md`, `src/case/CLAUDE.md`, `README.md` and `.env.example` for the new module, variables and dependencies (`sharp`, `@aws-sdk/client-s3`, `multer` types).

## Capabilities

### New Capabilities

- `case-image`: uploading, replacing and removing a case's picture, validating the file, producing the optimized WebP and the blur placeholder, and keeping the S3 objects in sync with the case.

### Modified Capabilities

- `case-catalog`: list items and the detail view gain `image` and `blurImage`.
- `case-management`: deleting a case also removes its stored picture.
- `api-documentation`: the new image operations and the new response fields must be documented.

## Impact

- **Database**: two nullable columns on `cases` (`image_key`, `blur_image`); a Prisma 8 migration that the user applies (`db:migration:plan` / `db:migrate` are denied to the agent).
- **Code**: new `src/storage/` (S3 client wrapper), new image processing service, new endpoints and DTOs in `src/case/`, `PrismaService` unchanged except the contract regeneration, `AppModule` wiring.
- **Config**: new env variables `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`. Missing values fail at startup like `POSTGRES_URI` does.
- **Dependencies**: `sharp`, `@aws-sdk/client-s3`, `@types/multer`.
- **Public API**: additive only; list and detail responses get two fields. The strict "exactly these keys" scenarios of `case-catalog` change accordingly.
- **Tests**: unit tests for image processing (real `sharp` on a tiny fixture) and for the storage wrapper's key/URL logic; e2e with S3 replaced by an in-memory fake. No test touches the real bucket.
- **Out of scope**: authentication of write routes (the planned `admin-guard`), CDN setup, AVIF, several images per case, async processing queue.
