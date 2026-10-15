# Proposal

## Why

The `case/` module is a throwaway sample: it stores a flat record, returns every column from every endpoint and has no notion of a draft, an order or a short vs. full view. The portfolio frontend needs a real API where each case (a project from the author's career) is shown in a compact form on the list page and in an extended form on the detail page. This code will also be shown to employers, so the contract has to be explicit and tested rather than "whatever Prisma returns".

## What Changes

- Extend the `Case` model with the fields the portfolio needs: `company` (nullable), `teamSize` (nullable, >= 1), a period (`startedAt`, nullable `endedAt` meaning "ongoing"), `sortOrder` and `published` (default `false`).
- **BREAKING**: `achievements` changes from `String[]` to a list of structured items `{ title, description, metric }` stored as `jsonb` (value object). Existing sample rows are not migrated; the old column content is discarded.
- Serve two read projections from the same table, with explicit response DTOs mapped in the service (no separate entity):
  - `GET /cases` returns list items: `slug`, `name`, `category`, `stack`, `shortDescription`.
  - `GET /cases/:slug` returns the detail: list-item fields plus `description`, `role`, `projectLink`, `company`, `teamSize`, `period`, `achievements`.
- Public reads only expose `published` cases, ordered by `sortOrder` (then `createdAt`). An unpublished or unknown slug yields `404`.
- Add `PATCH /cases/:slug` and `DELETE /cases/:slug`; `slug` is immutable. Extend `POST /cases` and its DTO validation with the new fields.
- Internal columns (`createdAt`, `updatedAt`) never appear in public responses.
- Document response schemas in Swagger.
- The case module stops being a throwaway sample: it gets unit and e2e tests, and `CLAUDE.md` / `README.md` are updated accordingly.

Out of scope (separate changes): image upload, storage and blur placeholders (`case-images`); protecting write endpoints (`admin-guard`). Until `admin-guard` lands, write endpoints remain open and drafts cannot be listed.

## Capabilities

### New Capabilities

- `case-catalog`: public read access to published cases: compact list, detail by slug, ordering and visibility rules.
- `case-management`: creating, updating and deleting cases, including input validation of every case field.

### Modified Capabilities

<!-- None: openspec/specs/ is empty, no existing requirements change. -->

## Impact

- Code: `prisma/contract.prisma`, `src/case/*` (controller, service, DTOs, new response DTOs/mappers), `src/prisma/prisma.service.ts` (only if a new accessor is needed), Swagger setup.
- Database: new migration (new columns, `achievements` type change); applied by the user, since DB-mutating commands are denied to the agent.
- API: `GET /cases` and `GET /cases/:slug` response shapes change; `POST /cases` body changes (`achievements` objects, new optional/required fields).
- Dependencies: none expected.
- Docs: `CLAUDE.md`, `src/case/CLAUDE.md`, `README.md`.
