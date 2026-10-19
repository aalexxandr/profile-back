# Tasks

Every behavior is a TDD pair: the test task comes first and must be run red for the right reason (not a compile error) before the implementation task. A task is done only after a green run of its tests.

## 1. Dependencies and configuration

- [x] 1.1 Add `sharp`, `@aws-sdk/client-s3` and dev `@types/multer` (pin versions, no `pnpm update --latest`); verify `pnpm install` succeeds and a throwaway unit test that imports `sharp` and encodes a 1x1 WebP passes under the project's Jest ESM setup (then delete the throwaway test)
- [x] 1.2 Add `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` to `.env.example` with comments (Selectel endpoint and region, bucket `portfolio`, public URL copied from the panel); verify the file lists all six and contains no real secrets (secretlint passes)

## 2. Image processing

- [x] 2.1 Write the red unit test `src/image/image-processing.service.spec.ts` for the spec scenarios of "Accept only real images" (text file named `.jpg`, GIF, truncated JPEG all give `BadRequestException`; JPEG, PNG, WebP pass), generating fixtures in the test with sharp
- [x] 2.2 Implement `ImageProcessingService` format sniffing, strict decoding and the pixel cap; verify 2.1 is green
- [x] 2.3 Write the red unit tests for "Produce an optimized WebP" (4000x2000 gives 1920x960, 400x300 stays 400x300, output starts with `RIFF` and has `WEBP` at offset 8, EXIF orientation applied and no EXIF in output, PNG alpha kept)
- [x] 2.4 Implement the optimized-copy pipeline (rotate, resize without enlargement, WebP quality 80); verify 2.3 is green
- [x] 2.5 Write the red unit tests for "Generate the blur placeholder" (prefix `data:image/webp;base64,`, decodes to a WebP no wider than 32 px with the source aspect ratio, shorter than 2 000 characters for a 1600x900 input)
- [x] 2.6 Implement the placeholder pipeline and the `ImageModule`/provider; verify 2.5 is green and `pnpm run typecheck` passes

## 3. Storage module

- [x] 3.1 Write the red unit test `src/storage/storage.service.spec.ts`: `publicUrl` joins base URL and key without double slashes, `put` sends `ContentType: image/webp` and the immutable `Cache-Control`, `delete` sends the key, a missing `S3_*` variable makes construction throw (S3 client mocked)
- [x] 3.2 Implement `StorageModule` and `StorageService` on `@aws-sdk/client-s3` configured through `getOrThrow`; verify 3.1 is green. While doing it, check the current Selectel S3 settings (endpoint, region, `forcePathStyle`) in the docs through Context7 or the Selectel documentation
- [x] 3.3 Add a reusable in-memory fake `StorageService` for tests under `test/helpers/` (put/delete/has/keys) with its own small unit test; verify the test is green

## 4. Schema and response fields

- [x] 4.1 Add `imageKey` and `blurImage` (nullable, `@map` to `image_key` and `blur_image`) to `Case` in `prisma/contract.prisma`; run `pnpm run db:generate` and verify `pnpm run typecheck` passes and the generated types contain both fields
- [x] 4.2 Ask the user to run `pnpm run db:migration:plan --name add-case-images`, review the SQL, then `db:migrate` and `db:verify` (these commands are denied to the agent); verify the migration file is in `migrations/` and only adds two nullable columns
- [x] 4.3 Extend `src/case/dto/case-serialization.spec.ts` with red cases: list item and detail expose `image` and `blurImage` (strings and `null`), and never expose `imageKey`; add the fixture fields to `case.fixtures.ts`
- [x] 4.4 Add `image` and `blurImage` with `@Expose()` and full `@ApiProperty` (nullable, description, example) to `CaseListItemDto` (inherited by `CaseDetailDto`); verify 4.3 is green
- [x] 4.5 Write the red `case.service.spec.ts` cases that every returned case view has `image` equal to `StorageService.publicUrl(imageKey)` or `null`, for `findAll`, `findBySlug`, `createCase` and `updateCase`; implement the row-to-view mapping in `CaseService`, inject `StorageService`; verify green
- [x] 4.6 Extend `test/case-catalog.e2e-spec.ts` (red first) for the new scenarios: exact list keys now include `image` and `blurImage`, a case without a picture has both `null`, a case with a stored key returns an absolute URL and a `data:image/webp;base64,` placeholder, no storage key leaks; make it green and update the existing key-list assertions

## 5. Upload and remove endpoints

- [x] 5.1 Write the red `case.service.spec.ts` cases for `setImage` orchestration (unknown slug gives 404 and no upload; success stores key `cases/<slug>/<hash>.webp`, saves the row, deletes the previous key; identical key is not deleted; storage failure leaves the row untouched; DB failure deletes the new object unless it equals the old key; failure deleting the old object is swallowed)
- [x] 5.2 Implement `CaseService.setImage`; verify 5.1 is green
- [x] 5.3 Write the red unit cases for `removeImage` (unknown slug 404, clears both columns and deletes the object, idempotent without an image) and for `deleteCase` removing the stored object of the deleted row; implement both; verify green
- [x] 5.4 Write the red e2e `test/case-image.e2e-spec.ts` with the in-memory storage fake (`overrideProvider`) and the real DB and sharp: upload JPEG 200, upload to a draft, unknown case 404 with nothing stored, missing `file` 400, text file named `.jpg` 400, GIF 400, truncated JPEG 400, over 10 MB 413, rejected upload keeps the previous image, stored bytes are WebP within 1920 px, same file twice gives the same URL, a different file replaces the object and removes the old key, `DELETE` image 204 and idempotent and 404, deleting the case removes the object, `PATCH`/`POST` with `image`/`blurImage` gives 400
- [x] 5.5 Add the `PUT /cases/:slug/image` (`FileInterceptor('file')` with the 10 MB limit) and `DELETE /cases/:slug/image` routes to `CaseController`, wire `StorageModule` and the image service into `CaseModule`; verify 5.4 is green
- [x] 5.6 Add Swagger to both routes: `@ApiOperation` with a description of the rules (formats, 10 MB, 1920 px WebP, auto-generated placeholder, old object removal, works on drafts), `@ApiConsumes('multipart/form-data')`, `@ApiBody` with a required binary `file`, `@ApiParam`, `@ApiOkResponse`/`@ApiNoContentResponse`, and `@ApiErrorResponse` for 400, 404, 413 (PUT) and 404 (DELETE)
- [x] 5.7 Extend `test/api-docs.e2e-spec.ts` (red before 5.6 is applied, green after) for the new `api-documentation` scenarios: summaries and descriptions of both routes, `slug` parameter on both, multipart body with required binary `file` and a description, `200` and `204` responses, exact error statuses, `image`/`blurImage` nullable with description and example, no storage key in any schema, no image properties in `CreateCaseDto`/`UpdateCaseDto`; add a tag description update in `src/config/swagger.config.ts` if the tag text no longer fits

## 6. Documentation and final verification

- [x] 6.1 Update `README.md` (Russian): the six `S3_*` variables, where to find the public URL in Selectel, and how to upload a picture with `curl -X PUT -F file=@photo.jpg`; verify the described commands match the routes
- [x] 6.2 Update `CLAUDE.md` (architecture: the storage and image modules, the env variables, the separate image routes, that e2e replace `StorageService`) and `src/case/CLAUDE.md` (the computed `image` field, `imageKey` stays unexposed, the best-effort cleanup rule); verify both mention every new module and variable
- [x] 6.3 Run `pnpm run check` and `pnpm run test:e2e --runInBand` (with the local DB up and the migration applied) and verify everything is green, every spec scenario of the four delta specs is covered by a test, and `openspec validate add-case-images` passes
- [x] 6.4 Manual check (by the user, with real S3 variables): upload one real picture with `curl`, open the returned `image` URL in a browser, and confirm it is a WebP that loads publicly; then `DELETE` the image and confirm the object disappears from the bucket

## Workflow follow-up

- Archive the change after `pnpm run check` is green and the manual check in 6.4 is done.
