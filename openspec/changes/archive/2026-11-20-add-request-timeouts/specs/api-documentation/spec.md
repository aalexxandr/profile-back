# Spec Delta

## MODIFIED Requirements

### Requirement: Describe error responses

Every operation SHALL document the error statuses it can return, each with the shared error schema `ErrorResponseDto` that has the properties `status`, `message`, `timestamp` and `path`: `POST /cases` documents `400`, `401`, `409` and `503`, `GET /cases` documents `503`, `GET /cases/{slug}` documents `404` and `503`, `PATCH /cases/{slug}` documents `400`, `401`, `404` and `503`, `DELETE /cases/{slug}` documents `401`, `404` and `503`, `PUT /cases/{slug}/image` documents `400`, `401`, `404`, `413`, `503` and `504`, and `DELETE /cases/{slug}/image` documents `401`, `404` and `503`. `GET /cases` and `GET /cases/{slug}` MUST NOT document `401`.

#### Scenario: Error statuses are documented per operation

- **WHEN** a client requests `GET /docs-json`
- **THEN** the responses of each operation include exactly the error statuses listed above, and each of them references `ErrorResponseDto`

#### Scenario: Error schema matches the real error body

- **WHEN** a client requests `GET /docs-json`
- **THEN** `ErrorResponseDto` has the properties `status`, `message`, `timestamp` and `path`

#### Scenario: Timeout statuses are described

- **WHEN** a client requests `GET /docs-json`
- **THEN** every operation under `/cases` documents `503` with a non-empty `description`
- **AND** `PUT /cases/{slug}/image` and `PUT /cases/{slug}/background` document `504` with a non-empty `description`, and no other operation documents `504`

### Requirement: Describe the background upload

`PUT /cases/{slug}/background` SHALL be documented with a `multipart/form-data` request body whose schema has the required binary property `file` with a description that states the accepted formats and the 10 MB limit, and with a `200` response that references the full view schema. `DELETE /cases/{slug}/background` SHALL be documented with a `204` response. Both operations MUST document `400`/`413`/`504` (upload only), `401`, `404` and `503` with the shared error schema and carry the `admin-token` security requirement.

#### Scenario: Background upload body is multipart with a binary file

- **WHEN** a client requests `GET /docs-json`
- **THEN** the request body of `PUT /cases/{slug}/background` has the content type `multipart/form-data` and its schema has a required property `file` of `type: string` and `format: binary` with a non-empty `description`

#### Scenario: Background upload and removal responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `PUT /cases/{slug}/background` documents `200` referencing `CaseFullDto` and `DELETE /cases/{slug}/background` documents `204`
- **AND** both operations document `401`, `404` and `503`, and the upload documents `400`, `413` and `504`
