# Design

## Context

See proposal.md for motivation. Current state that shapes the approach:

- `CaseService` returns database rows (`CaseRow`); the response shape is set by `@SerializeOptions({ type, strategy: 'excludeAll' })` and `@Expose()` DTOs, so a field that is not exposed never reaches the client.
- The Prisma 8 contract is `prisma/contract.prisma`; the agent may not run `db:*` commands that mutate the database, the user applies the migration.
- `ConfigService.getOrThrow` is the way required settings are read (`POSTGRES_URI`).
- Errors are formatted by `AllExceptionFilter`; unknown errors become a generic `500`. Multer errors surface as Nest `HttpException`s (`LIMIT_FILE_SIZE` becomes `413`, other upload errors `400`).
- E2E tests build the app with `createTestApp({ imports: [AppModule] })` against the real local DB. They must never reach the real bucket.
- `@nestjs/platform-express` is installed, so `FileInterceptor` works without a new HTTP dependency.
- Selectel S3 is S3-compatible; the bucket `portfolio` has public read.

## Goals / Non-Goals

**Goals:**

- One upload produces both the optimized picture (S3) and the placeholder (database).
- The storage is behind a small interface so every test can replace it.
- Database and bucket stay consistent in the failure cases listed in the spec.

**Non-Goals:**

- Authentication of the write routes (planned `admin-guard`).
- Several pictures per case, AVIF, responsive variants (`srcset`), a CDN, a job queue, or processing images asynchronously.
- Garbage collection of orphaned objects beyond the best-effort cleanup below.

## Decisions

### 1. Separate upload endpoint, JSON endpoints untouched

`PUT /cases/:slug/image` (multipart) and `DELETE /cases/:slug/image`. `achievements` and `stack` are nested structures that multipart cannot carry without custom parsing, so folding the file into `POST`/`PATCH` would rewrite the DTOs, their tests and the Swagger schemas. `PUT` is idempotent, which matches "set the image of this case". The JSON DTOs keep rejecting `image` / `blurImage` through the existing `forbidNonWhitelisted`, which needs no code.

### 2. Placeholder lives in the database as a data URI

`blur_image text null` holds `data:image/webp;base64,...` (about 20 px wide, below 2 000 characters). It arrives in the same JSON as the case, so the frontend paints it with no extra request. Alternative: a second S3 object with a URL; rejected because the placeholder would cost one more round trip, which defeats its purpose, and replace/delete would need to manage two objects. Trade-off: list responses grow by roughly 1 KB per case, acceptable for a portfolio.

### 3. Store the object key, derive the URL

`image_key text null` stores `cases/<slug>/<hash>.webp`. The response field `image` is `S3_PUBLIC_URL + '/' + key`, computed when serializing. A change of domain or CDN then needs only an env change, not a data migration. The key is internal: it has no `@Expose()` and does not appear in Swagger.

`<hash>` is the first 16 hex characters of the SHA-256 of the optimized bytes. Content-addressed names make URLs immutable (cache them forever), make identical re-uploads idempotent, and mean a replaced picture gets a new URL so no cache purge is needed.

### 4. Where the URL is built

`CaseService` maps each row to a view `CaseRow & { image: string | null }` through `StorageService.publicUrl(key)`, and the response DTOs expose `image` and `blurImage`. This keeps the controller free of logic and keeps `class-transformer` free of injected services. `findAll`, `findBySlug`, `createCase`, `updateCase` and `setImage` all return the mapped view.

### 5. Storage module

`src/storage/` with `StorageModule` (imported by `CaseModule`) and `StorageService`:

```
put(key, body: Buffer, contentType): Promise<void>
delete(key): Promise<void>
publicUrl(key): string
```

It wraps `@aws-sdk/client-s3` (`PutObjectCommand`, `DeleteObjectCommand`) configured from `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` through `getOrThrow`, so a misconfigured deployment fails at startup. Objects are uploaded with `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`. `S3_PUBLIC_URL` is a value the user copies from the Selectel panel (the public address form of the bucket); the code does not guess it. Whether Selectel needs path-style addressing (`forcePathStyle`) is verified against current docs while implementing.

Tests replace `StorageService` with an in-memory fake through `overrideProvider(StorageService)`; the override means the real constructor (and so the six env variables) is never needed in CI or in local e2e runs.

### 6. Image processing service

`ImageProcessingService.process(buffer)` returns `{ image: Buffer, blur: string }` or throws `BadRequestException`. It is a pure function of the input bytes, so it needs no mocks.

- Format is read from the bytes via `sharp(buffer).metadata()`; only `jpeg`, `png`, `webp` pass. File name and declared `Content-Type` are ignored.
- Decoding is strict (`failOn: 'warning'`, because libvips reports a truncated JPEG as a warning, not an error) and capped by `limitInputPixels` (50 megapixels) so a small file cannot expand into a memory bomb. Any decode failure becomes `400`.
- Optimized copy: `.rotate()` (apply EXIF orientation), `.resize({ width: 1920, withoutEnlargement: true })`, `.webp({ quality: 80 })`. sharp drops metadata unless asked to keep it, and WebP keeps PNG transparency. Animated input yields its first frame.
- Placeholder: from the same decoded input, `.resize({ width: 20 })`, `.blur(1)`, `.webp({ quality: 40 })`, then `'data:image/webp;base64,' + toString('base64')`.
- Processing runs inside the request. A single image up to 10 MB takes a fraction of a second and uploads are rare; a queue would only add moving parts.

Alternative considered: a `file-type` library for sniffing. Rejected: sharp already identifies the format while decoding, one dependency less.

### 7. Upload orchestration (`CaseService.setImage`)

```
1. row = first({ slug })              -> 404 if missing          (no CPU spent, nothing uploaded)
2. { image, blur } = process(file)    -> 400 on bad input
3. key = cases/<slug>/<hash>.webp
4. storage.put(key, image)            -> 500 on failure, DB untouched
5. update({ imageKey: key, blurImage: blur })
     on failure: if key != row.imageKey -> storage.delete(key) (best effort), rethrow
6. if row.imageKey && row.imageKey != key -> storage.delete(row.imageKey) (best effort)
7. return mapped view
```

The new object is saved before the old one is removed, so a failure never leaves the case pointing at nothing. Deleting the old object is best-effort: a failure is logged and the response stays successful; the cost is a possible orphan object, not a broken case. The same rule applies to `removeImage` (read row, set both columns to `null`, delete the object) and `deleteCase` (the delete returns the removed row, whose key is then deleted).

Concurrent uploads to the same case are not serialized; with a single administrator this is accepted and can at worst orphan one object.

### 8. Controller and upload limits

`@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))` with the default in-memory storage; the buffer goes straight to sharp. A missing `file` raises `BadRequestException`. Swagger uses `@ApiConsumes('multipart/form-data')` and `@ApiBody` with a schema holding the required binary property `file`; `@ApiErrorResponse` for `400`, `404`, `413` on `PUT` and `404` on `DELETE`. The `slug` `@ApiParam` is shared with the existing routes.

### 9. Schema

```
imageKey   String? @map("image_key")
blurImage  String? @map("blur_image")
```

on `Case`, in `prisma/contract.prisma`. Nullable columns need no backfill and no default, so the migration is additive and safe for existing rows. Generate with `pnpm run db:generate`; the migration is planned with `db:migration:plan --name add-case-images` and applied by the user with `db:migrate` followed by `db:verify`.

### 10. Test levels and mocks

| Behavior                                                                                                                                               | Level                                     | Real / mocked                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| Format sniffing, corrupted file, WebP signature, 1920 cap, no enlargement, orientation, metadata stripped, placeholder size and prefix                 | unit (`image-processing.service.spec.ts`) | real sharp on tiny images generated in the test with sharp itself      |
| Key and public URL building, env validation                                                                                                            | unit (`storage.service.spec.ts`)          | S3 client mocked                                                       |
| `CaseService.setImage` / `removeImage` / `deleteCase` orchestration, rollback and best-effort cleanup                                                  | unit (`case.service.spec.ts`)             | Prisma, storage, image service mocked                                  |
| Response mapping and exposed keys (`image`, `blurImage` yes, `imageKey` no)                                                                            | unit (`case-serialization.spec.ts`)       | none                                                                   |
| `PUT`/`DELETE` image over HTTP: statuses 200/204/400/404/413, replace, identical re-upload, delete case removes object, JSON body rejects image fields | e2e (`test/case-image.e2e-spec.ts`)       | real DB and real sharp; `StorageService` replaced by an in-memory fake |
| Catalog keys with and without a picture                                                                                                                | e2e (extend `case-catalog.e2e-spec.ts`)   | as above                                                               |
| Swagger multipart schema, new statuses, new fields, no storage key                                                                                     | e2e without DB (`api-docs.e2e-spec.ts`)   | stub providers                                                         |

## Risks / Trade-offs

- [sharp needs a native binary in pnpm, CI and Jest ESM mode] → add the dependency first and run a smoke import and `pnpm test` before building on it; allow its build/optional packages in pnpm settings if install warns.
- [Orphan objects after a failed delete or a crash between upload and DB update] → best-effort cleanup plus logging; the content-hash names make orphans harmless apart from storage cost.
- [Lossy WebP can soften fine text in screenshots] → quality is a single constant; raise it if the author notices artifacts.
- [Placeholder bloats list JSON] → bounded at about 1 KB per case and asserted below 2 000 characters in tests.
- [Public URL misconfigured, images 404 on the frontend] → `S3_PUBLIC_URL` is copied from the Selectel panel and documented in `README.md`; a manual check with the first real upload is part of the final task.
- [Write routes are unauthenticated, so anyone can upload] → same exposure as the existing write routes until `admin-guard`; the size limit and format check bound the damage, and the guard will cover the new routes when it lands.

## Migration Plan

1. Land code with the schema change; run `pnpm run db:generate`.
2. The user runs `db:migration:plan --name add-case-images`, reviews the SQL (two `ADD COLUMN`s, nullable), then `db:migrate` and `db:verify`.
3. The user adds the six `S3_*` variables to `.env` (and to the deployment environment).
4. Rollback: the columns are nullable and unused by old code; reverting the code leaves harmless extra columns. Uploaded objects stay in the bucket and can be deleted by key prefix `cases/`.
