## MODIFIED Requirements

### Requirement: Return case detail by slug

`GET /cases/:slug` SHALL return the extended view of a published case in the language chosen by `lang`: `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `projectLink`, `image`, `blurImage`, `description`, `role`, `company`, `teamSize`, `startedAt`, `endedAt` and `achievements`. `startedAt` and `endedAt` MUST be top-level ISO dates (`YYYY-MM-DD`), with `endedAt` being `null` while the work is ongoing; there is no nested `period` object. Each achievement MUST be `{ title, description, metric }`. `image` and `blurImage` follow the same rules as in the list and are `null` while the case has no picture. Neither the detail nor the list (`GET /cases`) MUST contain `backgroundImage` or `backgroundBlurImage`.

#### Scenario: Detail of a published case

- **WHEN** a published case with slug `spectre` exists and a client requests `GET /cases/spectre`
- **THEN** the response is `200` with all the fields listed above
- **AND** the response has no `translations`, `published`, `sortOrder`, `createdAt`, `updatedAt`, `period` or internal storage key

#### Scenario: Detail is localized

- **WHEN** a published case has both translations and a client requests `GET /cases/spectre?lang=en`
- **THEN** `name`, `category`, `shortDescription`, `description` and every achievement are the `en` texts and `locale` is `en`

#### Scenario: Optional fields are null, not omitted

- **WHEN** a published case has no `company`, no `teamSize`, no end date and no picture, and a client requests its detail
- **THEN** `company` is `null`, `teamSize` is `null`, `endedAt` is `null`, `image` is `null` and `blurImage` is `null`

#### Scenario: Detail of a case with a picture

- **WHEN** a published case has a stored picture and a client requests its detail
- **THEN** `image` is an absolute `http(s)` URL and `blurImage` starts with `data:image/webp;base64,`

#### Scenario: Detail of a case with a background

- **WHEN** a published case `spectre` exists, an object `cases/spectre/background/cd34ef56ab78ab12.webp` is left over in the storage, and a client requests `GET /cases/spectre`
- **THEN** the response is `200` and has no `backgroundImage`, no `backgroundBlurImage` and no `backgroundImageKey`

#### Scenario: List has no background fields

- **WHEN** a published case exists and a client requests `GET /cases`
- **THEN** its item has no `backgroundImage` and no `backgroundBlurImage`
