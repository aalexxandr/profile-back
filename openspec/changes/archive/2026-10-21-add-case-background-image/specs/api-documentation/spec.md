## ADDED Requirements

### Requirement: Describe the background upload

`PUT /cases/{slug}/background` SHALL be documented with a `multipart/form-data` request body whose schema has the required binary property `file` with a description that states the accepted formats and the 10 MB limit, and with a `200` response that references the full view schema. `DELETE /cases/{slug}/background` SHALL be documented with a `204` response. Both operations MUST document `400`/`413` (upload only), `401` and `404` with the shared error schema and carry the `admin-token` security requirement.

#### Scenario: Background upload body is multipart with a binary file

- **WHEN** a client requests `GET /docs-json`
- **THEN** the request body of `PUT /cases/{slug}/background` has the content type `multipart/form-data` and its schema has a required property `file` of `type: string` and `format: binary` with a non-empty `description`

#### Scenario: Background upload and removal responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `PUT /cases/{slug}/background` documents `200` referencing `CaseFullDto` and `DELETE /cases/{slug}/background` documents `204`
- **AND** both operations document `401` and `404`, and the upload documents `400` and `413`

### Requirement: Describe the background fields in responses

`CaseDetailDto` and `CaseFullDto` SHALL list `backgroundImage` and `backgroundBlurImage` as nullable strings, each with a description and an example. `CaseListItemDto`, `CreateCaseDto` and `UpdateCaseDto` MUST NOT have these properties, and the internal storage key of the background MUST NOT appear in any schema.

#### Scenario: Background fields are documented

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CaseDetailDto` and `CaseFullDto` have the properties `backgroundImage` and `backgroundBlurImage`, both `nullable`, with a non-empty `description` and an `example`
- **AND** `CaseListItemDto` has neither of them

#### Scenario: Request bodies do not accept background fields

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto` and `UpdateCaseDto` have no `backgroundImage` and no `backgroundBlurImage` property
- **AND** no schema in the document has a property for the background storage key
