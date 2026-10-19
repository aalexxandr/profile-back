## ADDED Requirements

### Requirement: Describe authentication

The document SHALL declare a bearer security scheme with a description of how to obtain and send the administrator token. Every protected operation (`POST /cases`, `PATCH /cases/{slug}`, `DELETE /cases/{slug}`, `PUT /cases/{slug}/image`, `DELETE /cases/{slug}/image`) MUST reference that scheme in its `security`. The public operations (`GET /cases`, `GET /cases/{slug}`) MUST NOT require it. The document `info.description` MUST NOT claim that the write endpoints are unprotected.

#### Scenario: Security scheme is declared

- **WHEN** a client requests `GET /docs-json`
- **THEN** `components.securitySchemes` has a scheme of `type: http` and `scheme: bearer` with a non-empty `description`

#### Scenario: Protected operations require the scheme

- **WHEN** a client requests `GET /docs-json`
- **THEN** each of `POST /cases`, `PATCH /cases/{slug}`, `DELETE /cases/{slug}`, `PUT /cases/{slug}/image` and `DELETE /cases/{slug}/image` has a non-empty `security` that references the declared scheme

#### Scenario: Public operations are open

- **WHEN** a client requests `GET /docs-json`
- **THEN** `GET /cases` and `GET /cases/{slug}` have no `security` requirement

#### Scenario: Description no longer says unprotected

- **WHEN** a client requests `GET /docs-json`
- **THEN** `info.description` does not contain the phrase `not protected`

## MODIFIED Requirements

### Requirement: Describe error responses

Every operation SHALL document the error statuses it can return, each with the shared error schema `ErrorResponseDto` that has the properties `status`, `message`, `timestamp` and `path`: `POST /cases` documents `400`, `401` and `409`, `GET /cases/{slug}` documents `404`, `PATCH /cases/{slug}` documents `400`, `401` and `404`, `DELETE /cases/{slug}` documents `401` and `404`, `PUT /cases/{slug}/image` documents `400`, `401`, `404` and `413`, and `DELETE /cases/{slug}/image` documents `401` and `404`. `GET /cases` and `GET /cases/{slug}` MUST NOT document `401`.

#### Scenario: Error statuses are documented per operation

- **WHEN** a client requests `GET /docs-json`
- **THEN** the responses of each operation include exactly the error statuses listed above, and each of them references `ErrorResponseDto`

#### Scenario: Error schema matches the real error body

- **WHEN** a client requests `GET /docs-json`
- **THEN** `ErrorResponseDto` has the properties `status`, `message`, `timestamp` and `path`
