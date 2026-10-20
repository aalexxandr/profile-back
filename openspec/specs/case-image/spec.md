# case-image Specification

## Purpose

Defines how a case gets its picture: a single uploaded image is re-encoded to an optimized WebP in the S3 bucket, a blur placeholder is generated into the database, and the API exposes both to the frontend as `image` and `blurImage`.

## Requirements

### Requirement: Upload a case image

`PUT /cases/:slug/image` SHALL accept a `multipart/form-data` body with exactly one file field `file`, store an optimized copy of the picture for the case, and respond `200` with the full view of the case (see `case-management`) including `image` and `blurImage`. The route MUST work for published and unpublished cases. Publishing a case MUST NOT require an image.

#### Scenario: Upload a JPEG

- **WHEN** a case `spectre` exists and a client sends `PUT /cases/spectre/image` with a valid JPEG in the field `file`
- **THEN** the response is `200` and `image` is an absolute `http(s)` URL ending in `.webp`
- **AND** `blurImage` is a string starting with `data:image/webp;base64,`
- **AND** the response contains `translations`

#### Scenario: Upload to a draft

- **WHEN** a case `draft` with `published = false` exists and a client sends `PUT /cases/draft/image` with a valid PNG
- **THEN** the response is `200`

#### Scenario: Unknown case

- **WHEN** a client sends `PUT /cases/does-not-exist/image` with a valid JPEG
- **THEN** the response is `404`
- **AND** nothing is written to the storage

#### Scenario: File field is missing

- **WHEN** a client sends `PUT /cases/spectre/image` as multipart without the field `file`
- **THEN** the response is `400`

### Requirement: Accept only real images within limits

The API SHALL accept JPEG, PNG and WebP, recognised by the content of the file and not by its name or declared type. A file that is not one of these formats, or is corrupted, MUST be rejected with `400`. A file larger than 10 MB MUST be rejected with `413`. A rejected upload MUST leave the case and the storage unchanged.

#### Scenario: Text file renamed to an image

- **WHEN** a client uploads a text file named `photo.jpg` with `Content-Type: image/jpeg`
- **THEN** the response is `400`

#### Scenario: Unsupported image format

- **WHEN** a client uploads a GIF
- **THEN** the response is `400`

#### Scenario: Corrupted image

- **WHEN** a client uploads a file that starts with valid JPEG bytes but is truncated and cannot be decoded
- **THEN** the response is `400`

#### Scenario: File over the size limit

- **WHEN** a client uploads a file larger than 10 MB
- **THEN** the response is `413`

#### Scenario: Rejected upload keeps the previous image

- **WHEN** a case already has an image and a client uploads an invalid file
- **THEN** the response is an error and `image` and `blurImage` of the case are unchanged

### Requirement: Produce an optimized WebP

The stored picture SHALL be a genuine WebP file re-encoded from the pixels of the upload, not the original bytes under a new name. Its width MUST NOT exceed 1920 px, a smaller picture MUST NOT be enlarged, the aspect ratio MUST be preserved, the EXIF orientation MUST be applied, and metadata (EXIF, GPS) MUST NOT be kept. Transparency of a PNG MUST be preserved.

#### Scenario: Wide picture is downscaled

- **WHEN** a client uploads a 4000x2000 JPEG
- **THEN** the stored file is a WebP of 1920x960

#### Scenario: Small picture is not enlarged

- **WHEN** a client uploads a 400x300 PNG
- **THEN** the stored file is a WebP of 400x300

#### Scenario: Stored bytes are WebP

- **WHEN** a client uploads a JPEG
- **THEN** the stored object starts with the bytes `RIFF` and contains `WEBP` at offset 8
- **AND** its content type is `image/webp`

#### Scenario: Orientation and metadata

- **WHEN** a client uploads a JPEG with EXIF orientation "rotated 90 degrees" and GPS data
- **THEN** the stored picture is physically rotated upright and contains no EXIF block

### Requirement: Generate the blur placeholder

The API SHALL generate `blurImage` itself from the uploaded picture; a client MUST NOT supply it. `blurImage` MUST be a `data:image/webp;base64,...` URI of a blurred copy about 20 px wide that keeps the aspect ratio of the picture, and its length MUST stay below 2 000 characters.

#### Scenario: Placeholder is small and decodable

- **WHEN** a client uploads a 1600x900 JPEG
- **THEN** `blurImage` decodes from base64 to a valid WebP no wider than 32 px with the aspect ratio of the upload
- **AND** `blurImage` is shorter than 2 000 characters

### Requirement: Name stored objects by content

The stored object key SHALL be `cases/<slug>/<hash>.webp`, where `<hash>` is derived from the content of the optimized picture. The public `image` URL MUST be the configured public base URL joined with that key.

#### Scenario: Same picture, same URL

- **WHEN** the same file is uploaded twice to the same case
- **THEN** both responses contain the same `image`

#### Scenario: Different pictures, different URLs

- **WHEN** two different pictures are uploaded to the same case one after another
- **THEN** the second response has a different `image` than the first

### Requirement: Replace an image

Uploading a picture to a case that already has one SHALL replace it, and the previous stored object MUST be removed once the new one is saved, unless the previous and the new key are equal.

#### Scenario: Old object is removed

- **WHEN** a case has an image with key `k1` and a client uploads a different picture that gets key `k2`
- **THEN** the object `k2` exists in the storage and the object `k1` does not

#### Scenario: Identical re-upload keeps the object

- **WHEN** a case has an image with key `k1` and a client uploads the same picture again
- **THEN** the object `k1` still exists in the storage

### Requirement: Remove an image

`DELETE /cases/:slug/image` SHALL clear `image` and `blurImage` of the case, remove the stored object, and respond `204`. It MUST be idempotent for a case that has no image, and respond `404` for an unknown case.

#### Scenario: Remove an existing image

- **WHEN** a case has an image and a client sends `DELETE /cases/spectre/image`
- **THEN** the response is `204`, the object is removed from the storage, and the case detail has `image: null` and `blurImage: null`

#### Scenario: Remove when there is no image

- **WHEN** a case without an image exists and a client sends `DELETE /cases/spectre/image`
- **THEN** the response is `204`

#### Scenario: Unknown case

- **WHEN** a client sends `DELETE /cases/does-not-exist/image`
- **THEN** the response is `404`

### Requirement: Stay consistent when the storage fails

If the storage rejects the upload, the API SHALL respond with the standard generic `500` and leave the case unchanged. If saving the case fails after the object was uploaded, the newly uploaded object MUST be removed on a best-effort basis, unless it is the same object the case already uses.

#### Scenario: Storage is unavailable

- **WHEN** the storage fails while a client uploads a valid picture
- **THEN** the response is `500` with the standard error body and the case keeps its previous `image` and `blurImage`

### Requirement: Image fields are not part of the JSON case body

`POST /cases` and `PATCH /cases/:slug` SHALL reject `image` and `blurImage` as unknown fields with `400`.

#### Scenario: Image field in the JSON body

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "blurImage": "data:image/webp;base64,AAAA" }`
- **THEN** the response is `400`

### Requirement: Image management requires the admin token

`PUT /cases/:slug/image` and `DELETE /cases/:slug/image` SHALL require the administrator token (see `admin-auth`) and respond `401` without a valid one. A rejected request MUST NOT read or process the uploaded file, write to the storage, or change the case.

#### Scenario: Upload without a token

- **WHEN** a case `spectre` exists and a client sends `PUT /cases/spectre/image` with a valid JPEG and no `Authorization` header
- **THEN** the response is `401`
- **AND** nothing is written to the storage and `image` of the case is unchanged

#### Scenario: Upload with a wrong token

- **WHEN** a client sends `PUT /cases/spectre/image` with a valid JPEG and `Authorization: Bearer wrong-token`
- **THEN** the response is `401`

#### Scenario: Removal without a token

- **WHEN** a case `spectre` has a picture and a client sends `DELETE /cases/spectre/image` with no token
- **THEN** the response is `401` and the picture and its stored object are still there

#### Scenario: Upload with the token

- **WHEN** a client sends `PUT /cases/spectre/image` with a valid JPEG and the valid token
- **THEN** the response is `200` as described for uploads
