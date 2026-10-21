# api-documentation Specification

## Purpose

Defines what the generated OpenAPI document (`/docs-json`, shown at `/docs`) must contain so that a client developer can use the cases API without reading the source code.

## Requirements

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

### Requirement: Describe request bodies

The schemas of the `POST /cases` and `PATCH /cases/{slug}` request bodies SHALL list every accepted field with its type and, where the API enforces one, its constraint. Required and optional fields MUST be distinguished. The text of a case MUST be documented only inside `translations`.

#### Scenario: Create body lists all fields

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto` has the properties `slug`, `projectLink`, `stack`, `role`, `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published` and `translations`
- **AND** `slug`, `projectLink`, `stack`, `role`, `startedAt` and `translations` are required and the other properties are not
- **AND** `CreateCaseDto` has no `name`, `category`, `shortDescription`, `description` or `achievements` property

#### Scenario: Create translations require Russian

- **WHEN** a client requests `GET /docs-json`
- **THEN** the schema of `CreateCaseDto.translations` has the properties `ru` and `en`, and only `ru` is required

#### Scenario: Constraints are visible

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto.slug` has a `maxLength` of 50 and a `pattern`, `CreateCaseDto.teamSize` has a `minimum` of 1, and `CreateCaseDto.role` lists `FRONTEND` and `FULLSTACK` as its `enum`

#### Scenario: Update body is partial and has no slug

- **WHEN** a client requests `GET /docs-json`
- **THEN** `UpdateCaseDto` has no required properties and no `slug` property
- **AND** the schema of `UpdateCaseDto.translations` and the schemas of its locales have no required properties

#### Scenario: Achievement items are described

- **WHEN** a client requests `GET /docs-json`
- **THEN** `AchievementDto` has the properties `title`, `description` and `metric`, all required

### Requirement: Describe error responses

Every operation SHALL document the error statuses it can return, each with the shared error schema `ErrorResponseDto` that has the properties `status`, `message`, `timestamp` and `path`: `POST /cases` documents `400`, `401` and `409`, `GET /cases/{slug}` documents `404`, `PATCH /cases/{slug}` documents `400`, `401` and `404`, `DELETE /cases/{slug}` documents `401` and `404`, `PUT /cases/{slug}/image` documents `400`, `401`, `404` and `413`, and `DELETE /cases/{slug}/image` documents `401` and `404`. `GET /cases` and `GET /cases/{slug}` MUST NOT document `401`.

#### Scenario: Error statuses are documented per operation

- **WHEN** a client requests `GET /docs-json`
- **THEN** the responses of each operation include exactly the error statuses listed above, and each of them references `ErrorResponseDto`

#### Scenario: Error schema matches the real error body

- **WHEN** a client requests `GET /docs-json`
- **THEN** `ErrorResponseDto` has the properties `status`, `message`, `timestamp` and `path`

### Requirement: Describe the image upload

`PUT /cases/{slug}/image` SHALL be documented with a `multipart/form-data` request body whose schema has the required binary property `file` with a description that states the accepted formats and the 10 MB limit, and with a `200` response that references the full view schema. `DELETE /cases/{slug}/image` SHALL be documented with a `204` response.

#### Scenario: Upload body is multipart with a binary file

- **WHEN** a client requests `GET /docs-json`
- **THEN** the request body of `PUT /cases/{slug}/image` has the content type `multipart/form-data` and its schema has a required property `file` of `type: string` and `format: binary` with a non-empty `description`

#### Scenario: Upload and removal responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `PUT /cases/{slug}/image` documents `200` referencing `CaseFullDto` and `DELETE /cases/{slug}/image` documents `204`

### Requirement: Describe the image fields in responses

`CaseListItemDto` and `CaseDetailDto` SHALL list `image` and `blurImage` as nullable strings, each with a description and an example, and the internal storage key MUST NOT appear in any response schema.

#### Scenario: Image fields are documented

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CaseListItemDto` and `CaseDetailDto` have the properties `image` and `blurImage`, both `nullable`, with a non-empty `description` and an `example`
- **AND** no schema in the document has a property for the storage key

#### Scenario: Request bodies do not accept image fields

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto` and `UpdateCaseDto` have no `image` and no `blurImage` property

### Requirement: Document is consumable by code generators

The document served at `GET /docs-json` SHALL be a valid JSON OpenAPI 3.x document that a client code generator can process without outside input: its `openapi` field MUST start with `3.`, every internal `$ref` MUST point to an existing entry in `components.schemas`, and every schema in `components.schemas` MUST declare at least one property.

#### Scenario: Document is OpenAPI 3

- **WHEN** a client requests `GET /docs-json`
- **THEN** the response status is `200`, the body is JSON and its `openapi` field starts with `3.`

#### Scenario: Every reference resolves

- **WHEN** a client requests `GET /docs-json` and collects every `$ref` of the form `#/components/schemas/<Name>` found anywhere in the document
- **THEN** each `<Name>` exists as a key of `components.schemas`

#### Scenario: No empty schemas

- **WHEN** a client requests `GET /docs-json`
- **THEN** every schema in `components.schemas` has a `properties` object with at least one key

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

### Requirement: Describe localization

The document SHALL describe the `lang` query parameter of the public reads and the `locale` field of their responses, and SHALL describe the full view as its own schema, `CaseFullDto`, whose `translations` property holds the nullable `ru` and `en` translations.

#### Scenario: lang parameter is documented

- **WHEN** a client requests `GET /docs-json`
- **THEN** `GET /cases` and `GET /cases/{slug}` each have an optional query parameter `lang` with `enum` `["ru","en"]`, `default` `ru` and a non-empty `description`
- **AND** no other operation has a `lang` parameter

#### Scenario: locale is documented in public responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CaseListItemDto` and `CaseDetailDto` have the property `locale` with `enum` `["ru","en"]`, a non-empty `description` and an `example`

#### Scenario: Full view is its own schema

- **WHEN** a client requests `GET /docs-json`
- **THEN** `POST /cases` documents `201` and `PATCH /cases/{slug}` documents `200`, both referencing `CaseFullDto`
- **AND** `CaseFullDto.translations` has the properties `ru` and `en`, both `nullable`, and no schema property named `name` exists on `CaseFullDto`

#### Scenario: Translation schema is described

- **WHEN** a client requests `GET /docs-json`
- **THEN** the translation schema has the required properties `name`, `category`, `shortDescription`, `description` and `achievements`, each with a non-empty `description` and an `example`, and `name` has a `maxLength` of 100

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
