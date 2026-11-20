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
- **AND** `PUT /cases/{slug}/image` documents `504` with a non-empty `description`, and no other operation documents `504`

## REMOVED Requirements

### Requirement: Describe the background upload

**Reason**: The background routes are removed (see `case-management`, "Cases have no background routes").
**Migration**: Clients regenerate their types from `/docs-json`; the operations disappear from the generated client.

### Requirement: Describe the background fields in responses

**Reason**: `backgroundImage` and `backgroundBlurImage` are removed from every response.
**Migration**: Clients regenerate their types from `/docs-json`; the properties disappear from `CaseDetailDto` and `CaseFullDto`.

## ADDED Requirements

### Requirement: Document has no case background

The document SHALL NOT describe a case background: no path under `/cases` ends in `/background`, and no schema has a property `backgroundImage`, `backgroundBlurImage` or `backgroundImageKey`.

#### Scenario: Background operations are absent

- **WHEN** a client requests `GET /docs-json`
- **THEN** `paths` has no key `/cases/{slug}/background`

#### Scenario: Background properties are absent

- **WHEN** a client requests `GET /docs-json`
- **THEN** none of the schemas in `components.schemas`, including `CaseDetailDto` and `CaseFullDto`, has a property `backgroundImage`, `backgroundBlurImage` or `backgroundImageKey`
