## MODIFIED Requirements

### Requirement: Create a case

`POST /cases` SHALL create a case from a valid body and respond `201` with the created case in the full view. The body carries the language-independent fields and `translations` (see "Validate translations"). A new case MUST default to `published = false` and `sortOrder = 0` when these fields are omitted. `projectLink` is optional: a case created without it MUST be stored without a link and returned with `projectLink: null`.

#### Scenario: Create with required fields only

- **WHEN** a client sends `POST /cases` with all required fields, a complete `translations.ru`, and without `projectLink`, `company`, `teamSize`, `endedAt`, `published` and `sortOrder`
- **THEN** the response is `201` and contains the submitted values
- **AND** `projectLink`, `company`, `teamSize` and `endedAt` are `null`
- **AND** the case does not appear in `GET /cases`

#### Scenario: Create a published case with optional fields

- **WHEN** a client sends `POST /cases` with `published: true`, complete `translations.ru` and `translations.en`, `projectLink: "https://thespectre.io"`, `company: "Acme"`, `teamSize: 5`, `sortOrder: 3` and valid `startedAt` and `endedAt` dates
- **THEN** the response is `201`, `projectLink` equals `https://thespectre.io` and the case appears in `GET /cases`

#### Scenario: Create a published case without a link

- **WHEN** a client sends `POST /cases` with `published: true`, complete `translations.ru` and `translations.en` and without `projectLink`
- **THEN** the response is `201` with `projectLink: null` and the case appears in `GET /cases`

#### Scenario: Duplicate slug

- **WHEN** a case with slug `spectre` exists and a client sends `POST /cases` with `slug: "spectre"`
- **THEN** the response is `409` and the translations of the existing case are unchanged

### Requirement: Validate identity and text fields

The API SHALL reject with `400` a create or update body in which `slug` is not lowercase kebab-case of 1-50 characters, or `projectLink` is present and is not an `http` or `https` URL of at most 100 characters. An omitted `projectLink` is valid. Unknown fields MUST be rejected with `400`. The limits of the text fields are described in "Validate translations".

#### Scenario: Slug is not kebab-case

- **WHEN** a client sends `POST /cases` with `slug: "My Case!"`
- **THEN** the response is `400`

#### Scenario: Link is not http or https

- **WHEN** a client sends `POST /cases` with `projectLink: "ftp://example.com"`
- **THEN** the response is `400`

#### Scenario: Empty link

- **WHEN** a client sends `POST /cases` with `projectLink: ""`
- **THEN** the response is `400`

#### Scenario: Unknown field

- **WHEN** a client sends `POST /cases` with an extra field `foo: 1`
- **THEN** the response is `400`

## ADDED Requirements

### Requirement: Keep the link of a case on update

`PATCH /cases/:slug` SHALL change `projectLink` only when the field is sent with a valid URL; a body without `projectLink` MUST leave the stored link unchanged, including when it is `null`. The link can be added to a case that has none.

#### Scenario: Add a link to a case without one

- **WHEN** a case `spectre` has `projectLink: null` and a client sends `PATCH /cases/spectre` with `{ "projectLink": "https://example.com" }`
- **THEN** the response is `200` with `projectLink: "https://example.com"`

#### Scenario: Link is untouched by an unrelated update

- **WHEN** a case `spectre` has no link and a client sends `PATCH /cases/spectre` with `{ "sortOrder": 2 }`
- **THEN** the response is `200` with `projectLink: null` and `sortOrder: 2`
