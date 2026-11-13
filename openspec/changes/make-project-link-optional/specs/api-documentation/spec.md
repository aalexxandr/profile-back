## MODIFIED Requirements

### Requirement: Describe request bodies

The schemas of the `POST /cases` and `PATCH /cases/{slug}` request bodies SHALL list every accepted field with its type and, where the API enforces one, its constraint. Required and optional fields MUST be distinguished. The text of a case MUST be documented only inside `translations`.

#### Scenario: Create body lists all fields

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto` has the properties `slug`, `projectLink`, `stack`, `role`, `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published` and `translations`
- **AND** `slug`, `stack`, `role`, `startedAt` and `translations` are required and the other properties, including `projectLink`, are not
- **AND** `CreateCaseDto` has no `name`, `category`, `shortDescription`, `description` or `achievements` property

#### Scenario: Create translations require Russian

- **WHEN** a client requests `GET /docs-json`
- **THEN** the schema of `CreateCaseDto.translations` has the properties `ru` and `en`, and only `ru` is required

#### Scenario: Constraints are visible

- **WHEN** a client requests `GET /docs-json`
- **THEN** `CreateCaseDto.slug` has a `maxLength` of 50 and a `pattern`, `CreateCaseDto.projectLink` has a `maxLength` of 100, `CreateCaseDto.teamSize` has a `minimum` of 1, and `CreateCaseDto.role` lists `FRONTEND` and `FULLSTACK` as its `enum`

#### Scenario: Update body is partial and has no slug

- **WHEN** a client requests `GET /docs-json`
- **THEN** `UpdateCaseDto` has no required properties and no `slug` property
- **AND** the schema of `UpdateCaseDto.translations` and the schemas of its locales have no required properties

#### Scenario: Achievement items are described

- **WHEN** a client requests `GET /docs-json`
- **THEN** `AchievementDto` has the properties `title`, `description` and `metric`, all required

## ADDED Requirements

### Requirement: Describe the nullable project link in responses

The response schemas that carry `projectLink` (the list item, the detail and the full view) SHALL document it as a nullable string, and keep it among their required properties, since the key is always present.

#### Scenario: Link is nullable in every response schema

- **WHEN** a client requests `GET /docs-json`
- **THEN** `projectLink` in `CaseListItemDto`, `CaseDetailDto` and `CaseFullDto` is a `string` with `nullable: true`
- **AND** `projectLink` is listed as required in each of these schemas
