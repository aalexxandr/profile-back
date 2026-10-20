# Spec Delta

## ADDED Requirements

### Requirement: Validate translations

Each translation object (`translations.ru`, `translations.en`) SHALL consist of `name` (1-100 characters), `category` (1-50), `shortDescription` (1-500), `description` (1-2000) and `achievements`. In a create body `translations.ru` MUST be present and complete, and `translations.en` MAY be omitted but, if present, MUST be complete. A translation with an unknown field, a locale other than `ru` and `en`, or a missing or empty `translations` MUST be rejected with `400`.

#### Scenario: Russian translation is required

- **WHEN** a client sends `POST /cases` with only `translations.en`
- **THEN** the response is `400`

#### Scenario: Incomplete English translation

- **WHEN** a client sends `POST /cases` with a complete `translations.ru` and a `translations.en` that lacks `description`
- **THEN** the response is `400`

#### Scenario: Name too long

- **WHEN** a client sends `POST /cases` with a `translations.ru.name` of 101 characters
- **THEN** the response is `400`

#### Scenario: Unknown locale

- **WHEN** a client sends `POST /cases` with a valid `translations.ru` and `translations.de`
- **THEN** the response is `400`

#### Scenario: Old flat text fields are rejected

- **WHEN** a client sends `POST /cases` with `name` and `description` at the top level next to `translations`
- **THEN** the response is `400`

### Requirement: Return all translations in the full view

`POST /cases`, `PATCH /cases/:slug` and `PUT /cases/:slug/image` SHALL respond with the full view of the case: `slug`, `projectLink`, `stack`, `role`, `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published`, `image`, `blurImage` and `translations`. `translations` MUST have the keys `ru` and `en`, each a complete translation or `null` when that language does not exist yet. The view MUST NOT contain `locale`.

#### Scenario: Draft with Russian only

- **WHEN** a client sends `POST /cases` with only `translations.ru`
- **THEN** the response is `201` and `translations.ru` equals the submitted text and `translations.en` is `null`

#### Scenario: Both translations are returned

- **WHEN** a client sends `PATCH /cases/spectre` for a case that has both translations
- **THEN** the response has `translations.ru` and `translations.en`, both complete, and has no top-level `name` or `locale`

## MODIFIED Requirements

### Requirement: Create a case

`POST /cases` SHALL create a case from a valid body and respond `201` with the created case in the full view. The body carries the language-independent fields and `translations` (see "Validate translations"). A new case MUST default to `published = false` and `sortOrder = 0` when these fields are omitted.

#### Scenario: Create with required fields only

- **WHEN** a client sends `POST /cases` with all required fields, a complete `translations.ru`, and without `company`, `teamSize`, `endedAt`, `published` and `sortOrder`
- **THEN** the response is `201` and contains the submitted values
- **AND** `company`, `teamSize` and `endedAt` are `null`
- **AND** the case does not appear in `GET /cases`

#### Scenario: Create a published case with optional fields

- **WHEN** a client sends `POST /cases` with `published: true`, complete `translations.ru` and `translations.en`, `company: "Acme"`, `teamSize: 5`, `sortOrder: 3` and valid `startedAt` and `endedAt` dates
- **THEN** the response is `201` and the case appears in `GET /cases`

#### Scenario: Duplicate slug

- **WHEN** a case with slug `spectre` exists and a client sends `POST /cases` with `slug: "spectre"`
- **THEN** the response is `409` and the translations of the existing case are unchanged

### Requirement: Validate identity and text fields

The API SHALL reject with `400` a create or update body in which `slug` is not lowercase kebab-case of 1-50 characters, or `projectLink` is not an `http` or `https` URL. Unknown fields MUST be rejected with `400`. The limits of the text fields are described in "Validate translations".

#### Scenario: Slug is not kebab-case

- **WHEN** a client sends `POST /cases` with `slug: "My Case!"`
- **THEN** the response is `400`

#### Scenario: Link is not http or https

- **WHEN** a client sends `POST /cases` with `projectLink: "ftp://example.com"`
- **THEN** the response is `400`

#### Scenario: Unknown field

- **WHEN** a client sends `POST /cases` with an extra field `foo: 1`
- **THEN** the response is `400`

### Requirement: Validate achievements

The API SHALL reject with `400` a translation in which `achievements` is not an array of at most 10 objects, each with non-empty `title`, `description` and `metric`. The array MAY be empty.

#### Scenario: Achievement missing a metric

- **WHEN** a client sends `POST /cases` with one achievement lacking `metric` in `translations.ru`
- **THEN** the response is `400`

#### Scenario: Too many achievements

- **WHEN** a client sends `POST /cases` with 11 achievements in `translations.en`
- **THEN** the response is `400`

### Requirement: Update a case

`PATCH /cases/:slug` SHALL apply a partial update to an existing case, whether published or not, and respond `200` with the updated full view. Fields not present in the body MUST stay unchanged. The `slug` MUST NOT be changeable. `translations` is merged: only the locales present are touched, and inside a locale only the fields present are changed; `achievements`, when present, replaces the whole array. A locale that does not exist yet MAY be created only with a complete translation; a partial one MUST be rejected with `400`. The two-language rule for `published` applies to the resulting state.

#### Scenario: Publish a draft

- **WHEN** a case `draft` with `published = false` and both translations exists and a client sends `PATCH /cases/draft` with `{ "published": true }`
- **THEN** the response is `200` and `GET /cases/draft` returns the case

#### Scenario: Untouched fields are preserved

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "projectLink": "https://example.com" }`
- **THEN** the response is `200` with `projectLink` changed and all other fields, including both translations, equal to their previous values

#### Scenario: Merge one field of one language

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "translations": { "en": { "name": "New name" } } }`
- **THEN** `translations.en.name` is `New name`, the other `en` fields and all `ru` fields are unchanged

#### Scenario: Achievements are replaced as a whole

- **WHEN** a case has three `ru` achievements and a client sends `PATCH` with `translations.ru.achievements` holding one item
- **THEN** `translations.ru.achievements` holds exactly that one item

#### Scenario: Partial new locale

- **WHEN** a case has only `ru` and a client sends `PATCH` with `{ "translations": { "en": { "name": "Only name" } } }`
- **THEN** the response is `400` and the case still has no `en` translation

#### Scenario: Slug in the body is rejected

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "slug": "other" }`
- **THEN** the response is `400`

#### Scenario: Update of an unknown case

- **WHEN** a client sends `PATCH /cases/does-not-exist` with `{ "projectLink": "https://example.com" }`
- **THEN** the response is `404`

### Requirement: Delete a case

`DELETE /cases/:slug` SHALL remove an existing case together with all its translations, whether published or not, and respond `204`. If the case has a stored picture, the stored object MUST be removed as well.

#### Scenario: Delete an existing case

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and `GET /cases/spectre` returns `404`

#### Scenario: Translations are removed with the case

- **WHEN** a case `spectre` with both translations is deleted and a case with the same slug is created again with only `translations.ru`
- **THEN** the new case has `translations.en` equal to `null`

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

- **WHEN** a case `spectre` exists and a client sends `PATCH /cases/spectre` with `{ "translations": { "ru": { "name": "Hacked" } } }` and no token
- **THEN** the response is `401` and the `ru` name of the case is unchanged

#### Scenario: Delete with a wrong token

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre` with `Authorization: Bearer wrong-token`
- **THEN** the response is `401` and `GET /cases/spectre` still returns the case (if published)

#### Scenario: Unauthenticated request for an unknown case

- **WHEN** a client sends `PATCH /cases/does-not-exist` with no token
- **THEN** the response is `401`, not `404`, so the existence of a case is not revealed

#### Scenario: Public read stays open

- **WHEN** a client sends `GET /cases` with no token
- **THEN** the response is `200`
