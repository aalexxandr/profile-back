# case-catalog Specification

## Purpose

Defines the public, read-only view of the portfolio's cases: a compact list for the index page and an extended detail view for a single case, limited to published cases and ordered by hand.

## Requirements

### Requirement: List published cases

`GET /cases` SHALL return a JSON array containing only published cases, with the texts in the language chosen by `lang` (see `case-localization`). Each item MUST contain exactly `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `image` and `blurImage`. `image` MUST be the absolute public URL of the case picture and `blurImage` the blur placeholder as a `data:image/webp;base64,...` URI; both are `null` while the case has no picture.

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

#### Scenario: Empty catalog

- **WHEN** no published case exists and a client requests `GET /cases`
- **THEN** the response is `200` with an empty array

### Requirement: Order the case list manually

`GET /cases` SHALL order items by `sortOrder` ascending, and by creation time descending when `sortOrder` is equal.

#### Scenario: Lower sortOrder comes first

- **WHEN** published cases `x` with `sortOrder` 2 and `y` with `sortOrder` 1 exist and a client requests `GET /cases`
- **THEN** `y` appears before `x`

#### Scenario: Tie broken by newest first

- **WHEN** published cases `old` and `new` both have `sortOrder` 0, `new` created later, and a client requests `GET /cases`
- **THEN** `new` appears before `old`

### Requirement: Return case detail by slug

`GET /cases/:slug` SHALL return the extended view of a published case in the language chosen by `lang`: `slug`, `locale`, `name`, `category`, `stack`, `shortDescription`, `projectLink`, `image`, `blurImage`, `description`, `role`, `company`, `teamSize`, `startedAt`, `endedAt` and `achievements`. `startedAt` and `endedAt` MUST be top-level ISO dates (`YYYY-MM-DD`), with `endedAt` being `null` while the work is ongoing; there is no nested `period` object. Each achievement MUST be `{ title, description, metric }`. `image` and `blurImage` follow the same rules as in the list and are `null` while the case has no picture.

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

### Requirement: Hide unpublished and unknown cases

`GET /cases/:slug` SHALL respond `404` when the case does not exist or is not published, with the same response in both situations.

#### Scenario: Unknown slug

- **WHEN** a client requests `GET /cases/does-not-exist`
- **THEN** the response is `404`

#### Scenario: Unpublished slug

- **WHEN** a case `draft` with `published = false` exists and a client requests `GET /cases/draft`
- **THEN** the response is `404`, identical to the response for an unknown slug
