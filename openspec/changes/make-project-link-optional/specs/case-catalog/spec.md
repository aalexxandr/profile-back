## MODIFIED Requirements

### Requirement: List published cases

`GET /cases` SHALL return a JSON array containing only published cases, with the texts in the language chosen by `lang` (see `case-localization`). Each item MUST contain exactly `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `projectLink`, `image` and `blurImage`. `projectLink` MUST be the link to the live project or `null` while the case has no link. `image` MUST be the absolute public URL of the case picture and `blurImage` the blur placeholder as a `data:image/webp;base64,...` URI; both are `null` while the case has no picture.

#### Scenario: Only published cases are listed

- **WHEN** the database holds the cases `a` (published) and `b` (not published) and a client requests `GET /cases`
- **THEN** the response is `200` and the array contains the item with slug `a` and no item with slug `b`

#### Scenario: List item exposes only the compact fields

- **WHEN** a client requests `GET /cases` and a published case exists
- **THEN** every item has exactly the keys `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `projectLink`, `image`, `blurImage`
- **AND** no item has `description`, `role`, `company`, `teamSize`, `period`, `achievements`, `translations`, `published`, `sortOrder`, `createdAt`, `updatedAt` or the internal storage key of the picture

#### Scenario: List is localized

- **WHEN** a published case has `ru` name `Спектр` and `en` name `Spectre` and a client requests `GET /cases?lang=en`
- **THEN** its item has `name: "Spectre"` and `locale: "en"`

#### Scenario: Case with a picture

- **WHEN** a published case has a stored picture and a client requests `GET /cases`
- **THEN** its item has `image` equal to an absolute `http(s)` URL and `blurImage` starting with `data:image/webp;base64,`

#### Scenario: Case without a picture

- **WHEN** a published case has no picture and a client requests `GET /cases`
- **THEN** its item has `image: null` and `blurImage: null`

#### Scenario: Case without a link

- **WHEN** a published case has no `projectLink` and a client requests `GET /cases`
- **THEN** its item has the key `projectLink` with the value `null`

#### Scenario: Empty catalog

- **WHEN** no published case exists and a client requests `GET /cases`
- **THEN** the response is `200` with an empty array

### Requirement: Return case detail by slug

`GET /cases/:slug` SHALL return the extended view of a published case in the language chosen by `lang`: `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `projectLink`, `image`, `blurImage`, `backgroundImage`, `backgroundBlurImage`, `description`, `role`, `company`, `teamSize`, `startedAt`, `endedAt` and `achievements`. `projectLink` MUST be `null` while the case has no link. `startedAt` and `endedAt` MUST be top-level ISO dates (`YYYY-MM-DD`), with `endedAt` being `null` while the work is ongoing; there is no nested `period` object. Each achievement MUST be `{ title, description, metric }`. `image` and `blurImage` follow the same rules as in the list and are `null` while the case has no picture. `backgroundImage` MUST be the absolute public URL of the case background and `backgroundBlurImage` its blur placeholder as a `data:image/webp;base64,...` URI; both are `null` while the case has no background. The list (`GET /cases`) MUST NOT contain the background fields.

#### Scenario: Detail of a published case

- **WHEN** a published case with slug `spectre` exists and a client requests `GET /cases/spectre`
- **THEN** the response is `200` with all the fields listed above
- **AND** the response has no `translations`, `published`, `sortOrder`, `createdAt`, `updatedAt`, `period` or internal storage key

#### Scenario: Detail is localized

- **WHEN** a published case has both translations and a client requests `GET /cases/spectre?lang=en`
- **THEN** `name`, `category`, `shortDescription`, `description` and every achievement are the `en` texts and `locale` is `en`

#### Scenario: Optional fields are null, not omitted

- **WHEN** a published case has no `projectLink`, no `company`, no `teamSize`, no end date, no picture and no background, and a client requests its detail
- **THEN** `projectLink` is `null`, `company` is `null`, `teamSize` is `null`, `endedAt` is `null`, `image` is `null`, `blurImage` is `null`, `backgroundImage` is `null` and `backgroundBlurImage` is `null`

#### Scenario: Detail of a case with a picture

- **WHEN** a published case has a stored picture and a client requests its detail
- **THEN** `image` is an absolute `http(s)` URL and `blurImage` starts with `data:image/webp;base64,`

#### Scenario: Detail of a case with a background

- **WHEN** a published case has a stored background and a client requests its detail
- **THEN** `backgroundImage` is an absolute `http(s)` URL and `backgroundBlurImage` starts with `data:image/webp;base64,`

#### Scenario: List has no background fields

- **WHEN** a published case has a stored background and a client requests `GET /cases`
- **THEN** its item has no `backgroundImage` and no `backgroundBlurImage`
