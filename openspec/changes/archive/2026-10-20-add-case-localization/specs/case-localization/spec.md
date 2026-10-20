# Spec Delta

## Purpose

Defines how the text of a case is stored per language (`ru`, `en`), how a public request chooses the language, and the rule that a case is visible to the public only when it is translated into every supported language.

## ADDED Requirements

### Requirement: Supported locales

The API SHALL support exactly two locales, `ru` and `en`. `ru` is the default locale. The translatable fields of a case are `name`, `category`, `shortDescription`, `description` and `achievements`; every other field of a case is the same for all locales.

#### Scenario: Language-independent fields are shared

- **WHEN** a case has translations `ru` and `en` and a client reads it with `?lang=ru` and then with `?lang=en`
- **THEN** `slug`, `stack`, `role`, `projectLink`, `company`, `teamSize`, `startedAt`, `endedAt`, `image` and `blurImage` are identical in both responses

### Requirement: Choose the language with the lang query parameter

The public reads `GET /cases` and `GET /cases/:slug` SHALL take the language from the query parameter `lang`. The `Accept-Language` header MUST NOT influence the result. When `lang` is absent, or is not `ru` or `en`, the response MUST be in `ru` and the request MUST NOT fail because of it.

#### Scenario: English requested

- **WHEN** a published case has both translations and a client requests `GET /cases/spectre?lang=en`
- **THEN** `name`, `category`, `shortDescription`, `description` and `achievements` are the `en` texts and `locale` is `en`

#### Scenario: No lang parameter

- **WHEN** a client requests `GET /cases/spectre` without `lang`
- **THEN** the texts are the `ru` texts and `locale` is `ru`

#### Scenario: Unsupported language falls back to Russian

- **WHEN** a client requests `GET /cases?lang=de`
- **THEN** the response is `200`, every item has the `ru` texts and `locale: "ru"`

#### Scenario: Accept-Language is ignored

- **WHEN** a client requests `GET /cases/spectre` with the header `Accept-Language: en` and without `lang`
- **THEN** the texts are the `ru` texts and `locale` is `ru`

### Requirement: Public responses report the served locale

Every item of `GET /cases` and the response of `GET /cases/:slug` SHALL contain `locale`, the language of the texts actually returned (`ru` or `en`).

#### Scenario: List items carry the locale

- **WHEN** published cases exist and a client requests `GET /cases?lang=en`
- **THEN** every item has `locale: "en"`

### Requirement: Publish only fully translated cases

A case SHALL be allowed to have `published = true` only while it has both a `ru` and an `en` translation. A request that would leave a case published without both translations MUST be rejected with `400` and MUST NOT change anything. A draft MAY have only `ru`. A translation can be replaced but never removed.

#### Scenario: Publish on create with both languages

- **WHEN** a client sends `POST /cases` with `published: true` and both `translations.ru` and `translations.en`
- **THEN** the response is `201` and the case appears in `GET /cases?lang=en`

#### Scenario: Publish on create without English

- **WHEN** a client sends `POST /cases` with `published: true` and only `translations.ru`
- **THEN** the response is `400` and the case does not exist afterwards

#### Scenario: Publish a draft that lacks English

- **WHEN** a draft with only a `ru` translation exists and a client sends `PATCH` with `{ "published": true }`
- **THEN** the response is `400` and the case is still a draft

#### Scenario: Add English and publish in one request

- **WHEN** a draft with only a `ru` translation exists and a client sends `PATCH` with `{ "published": true, "translations": { "en": <complete translation> } }`
- **THEN** the response is `200`, the case is published and `GET /cases/<slug>?lang=en` returns the `en` texts

#### Scenario: Published case stays fully translated

- **WHEN** a published case has both translations and a client sends `PATCH` with `{ "translations": { "ru": { "name": "Новое имя" } } }`
- **THEN** the response is `200` and the case is still published with both translations

### Requirement: Existing cases are migrated to Russian and unpublished

The data migration SHALL create a `ru` translation for every existing case from its current text, and SHALL set `published = false` on every case, so that no case is public without an `en` translation.

#### Scenario: Migrated case

- **WHEN** the migration runs on a database with a published case `spectre`
- **THEN** `spectre` has a `ru` translation equal to its previous text, has no `en` translation and has `published = false`
