# case-management Specification

## Purpose

Defines how cases are created, changed and removed through the API, including the validation rules for every case field and the guarantees about slug identity.

## Requirements

### Requirement: Create a case

`POST /cases` SHALL create a case from a valid body and respond `201` with the created case in the detail view. A new case MUST default to `published = false` and `sortOrder = 0` when these fields are omitted.

#### Scenario: Create with required fields only

- **WHEN** a client sends `POST /cases` with all required fields and without `company`, `teamSize`, `endedAt`, `published` and `sortOrder`
- **THEN** the response is `201` and contains the submitted values
- **AND** `company`, `teamSize` and `endedAt` are `null`
- **AND** the case does not appear in `GET /cases`

#### Scenario: Create a published case with optional fields

- **WHEN** a client sends `POST /cases` with `published: true`, `company: "Acme"`, `teamSize: 5`, `sortOrder: 3` and valid `startedAt` and `endedAt` dates
- **THEN** the response is `201` and the case appears in `GET /cases`

#### Scenario: Duplicate slug

- **WHEN** a case with slug `spectre` exists and a client sends `POST /cases` with `slug: "spectre"`
- **THEN** the response is `409`

### Requirement: Validate identity and text fields

The API SHALL reject with `400` a create or update body in which `slug` is not lowercase kebab-case of 1-50 characters, `name` is not 1-100 characters, or `projectLink` is not an `http` or `https` URL. Unknown fields MUST be rejected with `400`.

#### Scenario: Slug is not kebab-case

- **WHEN** a client sends `POST /cases` with `slug: "My Case!"`
- **THEN** the response is `400`

#### Scenario: Link is not http or https

- **WHEN** a client sends `POST /cases` with `projectLink: "ftp://example.com"`
- **THEN** the response is `400`

#### Scenario: Unknown field

- **WHEN** a client sends `POST /cases` with an extra field `foo: 1`
- **THEN** the response is `400`

### Requirement: Validate stack and team size

The API SHALL reject with `400` a body in which `stack` is not a non-empty array of at most 10 unique non-empty strings, or `teamSize` is present and is not an integer >= 1.

#### Scenario: Team size below one

- **WHEN** a client sends `POST /cases` with `teamSize: 0`
- **THEN** the response is `400`

#### Scenario: Duplicate stack entries

- **WHEN** a client sends `POST /cases` with `stack: ["React", "React"]`
- **THEN** the response is `400`

### Requirement: Validate period

The API SHALL require `startedAt` on create, accept `startedAt` and `endedAt` only as ISO dates (`YYYY-MM-DD`), and reject with `400` a body in which `endedAt` is earlier than `startedAt`.

#### Scenario: Period ends before it starts

- **WHEN** a client sends `POST /cases` with `startedAt: "2024-05-01"` and `endedAt: "2024-01-01"`
- **THEN** the response is `400`

#### Scenario: Missing start date

- **WHEN** a client sends `POST /cases` without `startedAt`
- **THEN** the response is `400`

### Requirement: Validate achievements

The API SHALL reject with `400` a body in which `achievements` is not an array of at most 10 objects, each with non-empty `title`, `description` and `metric`.

#### Scenario: Achievement missing a metric

- **WHEN** a client sends `POST /cases` with one achievement lacking `metric`
- **THEN** the response is `400`

#### Scenario: Too many achievements

- **WHEN** a client sends `POST /cases` with 11 achievements
- **THEN** the response is `400`

### Requirement: Update a case

`PATCH /cases/:slug` SHALL apply a partial update to an existing case, whether published or not, and respond `200` with the updated detail view. Fields not present in the body MUST stay unchanged. The `slug` MUST NOT be changeable.

#### Scenario: Publish a draft

- **WHEN** a case `draft` with `published = false` exists and a client sends `PATCH /cases/draft` with `{ "published": true }`
- **THEN** the response is `200` and `GET /cases/draft` returns the case

#### Scenario: Untouched fields are preserved

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "name": "New name" }`
- **THEN** the response is `200` with `name` equal to `New name` and all other fields equal to their previous values

#### Scenario: Slug in the body is rejected

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "slug": "other" }`
- **THEN** the response is `400`

#### Scenario: Update of an unknown case

- **WHEN** a client sends `PATCH /cases/does-not-exist` with `{ "name": "x" }`
- **THEN** the response is `404`

### Requirement: Delete a case

`DELETE /cases/:slug` SHALL remove an existing case, whether published or not, and respond `204`. If the case has a stored picture, the stored object MUST be removed as well.

#### Scenario: Delete an existing case

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and `GET /cases/spectre` returns `404`

#### Scenario: Delete a case that has a picture

- **WHEN** a case `spectre` has a stored picture and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and the stored object of the picture no longer exists

#### Scenario: Delete an unknown case

- **WHEN** a client sends `DELETE /cases/does-not-exist`
- **THEN** the response is `404`

### Requirement: Management requires the admin token

`POST /cases`, `PATCH /cases/:slug` and `DELETE /cases/:slug` SHALL require the administrator token (see `admin-auth`) and respond `401` without a valid one. A rejected request MUST NOT create, change or delete anything. Reading the catalog (`GET /cases`, `GET /cases/:slug`) stays public.

#### Scenario: Create without a token

- **WHEN** a client sends `POST /cases` with a valid body and no `Authorization` header
- **THEN** the response is `401` and the case does not exist afterwards

#### Scenario: Update without a token

- **WHEN** a case `spectre` exists and a client sends `PATCH /cases/spectre` with `{ "name": "Hacked" }` and no token
- **THEN** the response is `401` and the `name` of the case is unchanged

#### Scenario: Delete with a wrong token

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre` with `Authorization: Bearer wrong-token`
- **THEN** the response is `401` and `GET /cases/spectre` still returns the case (if published)

#### Scenario: Unauthenticated request for an unknown case

- **WHEN** a client sends `PATCH /cases/does-not-exist` with no token
- **THEN** the response is `401`, not `404`, so the existence of a case is not revealed

#### Scenario: Public read stays open

- **WHEN** a client sends `GET /cases` with no token
- **THEN** the response is `200`
