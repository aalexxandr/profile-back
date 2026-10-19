# api-documentation Specification

## MODIFIED Requirements

### Requirement: Describe every operation

Every operation under `/cases` SHALL have a non-empty `summary` and `description`, and the document `info` SHALL have a non-empty `description`. The operations SHALL be grouped under a tag that has a description.

#### Scenario: Operations carry text

- **WHEN** a client requests `GET /docs-json`
- **THEN** each of `POST /cases`, `GET /cases`, `GET /cases/{slug}`, `PATCH /cases/{slug}`, `DELETE /cases/{slug}`, `PUT /cases/{slug}/image` and `DELETE /cases/{slug}/image` has a non-empty `summary` and a non-empty `description`

#### Scenario: Document and tag are described

- **WHEN** a client requests `GET /docs-json`
- **THEN** `info.description` is non-empty and the tag used by the operations is listed in `tags` with a non-empty `description`

### Requirement: Describe path parameters

The `slug` path parameter of `GET`, `PATCH` and `DELETE /cases/{slug}` and of `PUT` and `DELETE /cases/{slug}/image` SHALL have a description and an example value.

#### Scenario: Slug parameter is documented

- **WHEN** a client requests `GET /docs-json`
- **THEN** the `slug` path parameter of `GET /cases/{slug}`, `PATCH /cases/{slug}`, `DELETE /cases/{slug}`, `PUT /cases/{slug}/image` and `DELETE /cases/{slug}/image` has a non-empty `description` and an `example`

### Requirement: Describe error responses

Every operation SHALL document the error statuses it can return, each with the shared error schema `ErrorResponseDto` that has the properties `status`, `message`, `timestamp` and `path`: `POST /cases` documents `400` and `409`, `GET /cases/{slug}` documents `404`, `PATCH /cases/{slug}` documents `400` and `404`, `DELETE /cases/{slug}` documents `404`, `PUT /cases/{slug}/image` documents `400`, `404` and `413`, and `DELETE /cases/{slug}/image` documents `404`.

#### Scenario: Error statuses are documented per operation

- **WHEN** a client requests `GET /docs-json`
- **THEN** the responses of each operation include exactly the error statuses listed above, and each of them references `ErrorResponseDto`

#### Scenario: Error schema matches the real error body

- **WHEN** a client requests `GET /docs-json`
- **THEN** `ErrorResponseDto` has the properties `status`, `message`, `timestamp` and `path`

## ADDED Requirements

### Requirement: Describe the image upload

`PUT /cases/{slug}/image` SHALL be documented with a `multipart/form-data` request body whose schema has the required binary property `file` with a description that states the accepted formats and the 10 MB limit, and with a `200` response that references the case detail schema. `DELETE /cases/{slug}/image` SHALL be documented with a `204` response.

#### Scenario: Upload body is multipart with a binary file

- **WHEN** a client requests `GET /docs-json`
- **THEN** the request body of `PUT /cases/{slug}/image` has the content type `multipart/form-data` and its schema has a required property `file` of `type: string` and `format: binary` with a non-empty `description`

#### Scenario: Upload and removal responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `PUT /cases/{slug}/image` documents `200` referencing `CaseDetailDto` and `DELETE /cases/{slug}/image` documents `204`

### Requirement: Describe the image fields in responses

`CaseListItemDto` and `CaseDetailDto` SHALL list `image` and `blurImage` as nullable strings, each with a description and an example, and the internal storage key MUST NOT appear in any response schema.

#### Scenario: Image fields are documented

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CaseListItemDto` and `CaseDetailDto` have the properties `image` and `blurImage`, both `nullable`, with a non-empty `description` and an `example`
- **AND** no schema in the document has a property for the storage key

#### Scenario: Request bodies do not accept image fields

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto` and `UpdateCaseDto` have no `image` and no `blurImage` property
