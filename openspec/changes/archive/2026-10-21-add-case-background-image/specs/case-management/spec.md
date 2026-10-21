## MODIFIED Requirements

### Requirement: Delete a case

`DELETE /cases/:slug` SHALL remove an existing case together with all its translations, whether published or not, and respond `204`. If the case has a stored picture or a stored background, the stored objects MUST be removed as well.

#### Scenario: Delete an existing case

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and `GET /cases/spectre` returns `404`

#### Scenario: Translations are removed with the case

- **WHEN** a case `spectre` with both translations is deleted and a case with the same slug is created again with only `translations.ru`
- **THEN** the new case has `translations.en` equal to `null`

#### Scenario: Delete a case that has a picture

- **WHEN** a case `spectre` has a stored picture and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and the stored object of the picture no longer exists

#### Scenario: Delete a case that has a background

- **WHEN** a case `spectre` has a stored background and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and the stored object of the background no longer exists

#### Scenario: Delete an unknown case

- **WHEN** a client sends `DELETE /cases/does-not-exist`
- **THEN** the response is `404`

### Requirement: Return all translations in the full view

`POST /cases`, `PATCH /cases/:slug`, `PUT /cases/:slug/image` and `PUT /cases/:slug/background` SHALL respond with the full view of the case: `slug`, `projectLink`, `stack`, `role`, `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published`, `image`, `blurImage`, `backgroundImage`, `backgroundBlurImage` and `translations`. `translations` MUST have the keys `ru` and `en`, each a complete translation or `null` when that language does not exist yet. The view MUST NOT contain `locale`. The JSON bodies of `POST` and `PATCH` MUST NOT accept the picture or background fields.

#### Scenario: Draft with Russian only

- **WHEN** a client sends `POST /cases` with only `translations.ru`
- **THEN** the response is `201` and `translations.ru` equals the submitted text and `translations.en` is `null`
- **AND** `backgroundImage` and `backgroundBlurImage` are `null`

#### Scenario: Both translations are returned

- **WHEN** a client sends `PATCH /cases/spectre` for a case that has both translations
- **THEN** the response has `translations.ru` and `translations.en`, both complete, and has no top-level `name` or `locale`

#### Scenario: Background fields are not writable through JSON

- **WHEN** a client sends `PATCH /cases/spectre` with `{ "backgroundImage": "https://example.com/x.webp" }`
- **THEN** the response is `400`
