# Spec Delta

## MODIFIED Requirements

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
