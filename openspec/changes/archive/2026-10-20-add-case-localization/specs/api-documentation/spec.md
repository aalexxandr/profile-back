# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Describe the image upload

`PUT /cases/{slug}/image` SHALL be documented with a `multipart/form-data` request body whose schema has the required binary property `file` with a description that states the accepted formats and the 10 MB limit, and with a `200` response that references the full view schema. `DELETE /cases/{slug}/image` SHALL be documented with a `204` response.

#### Scenario: Upload body is multipart with a binary file

- **WHEN** a client requests `GET /docs-json`
- **THEN** the request body of `PUT /cases/{slug}/image` has the content type `multipart/form-data` and its schema has a required property `file` of `type: string` and `format: binary` with a non-empty `description`

#### Scenario: Upload and removal responses

- **WHEN** a client requests `GET /docs-json`
- **THEN** `PUT /cases/{slug}/image` documents `200` referencing `CaseFullDto` and `DELETE /cases/{slug}/image` documents `204`
