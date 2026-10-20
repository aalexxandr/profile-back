# Proposal

## Why

The frontend that consumes this API is bilingual (`ru` and `en`, switched through i18n), but every case stores its text in a single language. The frontend cannot show a case in the language the visitor chose, so the API has to store and serve the text of a case per language.

## What Changes

- Move the human-readable text of a case (`name`, `category`, `shortDescription`, `description`, `achievements`) out of `cases` into a new table `case_translations`, one row per case and locale (`ru`, `en`), unique on `(case_slug, locale)`, deleted together with the case.
- Language-independent data stays in `cases`: `slug`, `projectLink`, `stack`, `role`, `company`, `teamSize`, `startedAt`, `endedAt`, `sortOrder`, `published`, picture fields, timestamps. `company` is deliberately not translated.
- `GET /cases` and `GET /cases/:slug` accept `?lang=ru|en`. A missing or unsupported value gives `ru`. `Accept-Language` is not used. Responses stay flat (`name`, `description`, ... already in the chosen language) and gain a `locale` field with the language actually served.
- **BREAKING** `POST /cases` and `PATCH /cases/:slug` take the text fields inside `translations: { ru, en }` instead of as top-level fields, and return the full set of translations. `ru` is always required on create; `en` is required when `published` is `true`. `PATCH` merges per locale and per field; `achievements` is replaced as a whole array.
- **BREAKING** A case can be published only when both `ru` and `en` exist. The rule is checked on the resulting state in `POST` and in `PATCH`; a translation can be replaced but never removed.
- **BREAKING** `PUT /cases/:slug/image` returns the full shape (with `translations`) instead of the old flat detail.
- Data migration: existing rows become `ru` translations; every case that is published at migration time is set to `published = false` until its `en` translation is added. The user applies the migration (the agent cannot run DB-mutating commands).
- Swagger, `test/api-docs.e2e-spec.ts`, `CLAUDE.md`, `src/case/CLAUDE.md` and `README.md` are updated to match.

## Capabilities

### New Capabilities

- `case-localization`: the supported locales, how a public request picks one (`?lang`, fallback to `ru`), the `locale` field of public responses, and the rule that a case is published only with both translations.

### Modified Capabilities

- `case-catalog`: list and detail return localized text from the chosen translation and include `locale`.
- `case-management`: create and update use `translations`; validation of text fields moves into the translation objects; the response is the full shape with all translations; publishing is guarded by the two-language rule.
- `case-image`: upload returns the full shape instead of the flat detail view.
- `api-documentation`: new and changed schemas (translation DTOs, public vs full response), the `lang` query parameter and its `400`-free fallback, updated lists of properties and error statuses.

## Impact

- **Code:** `prisma/contract.prisma` (new model, text columns leave `Case`), `PrismaService` (new getter), a new migration with data copy and unpublish step, `src/case/` (service, controller, constants, types, DTOs split into translation / public / full shapes), possibly a small `src/common` helper for resolving `lang`.
- **API:** breaking for `POST`, `PATCH` and `PUT /cases/:slug/image` bodies and responses, additive (`lang`, `locale`) for the public reads. The frontend must regenerate types from `/docs-json`.
- **Data:** all currently published cases are unpublished by the migration and must get an `en` translation before they are published again.
- **Tests:** unit tests for DTOs, locale resolution and the merge/publish rules; e2e tests for catalog, management, image and API docs (no real S3, as before).
