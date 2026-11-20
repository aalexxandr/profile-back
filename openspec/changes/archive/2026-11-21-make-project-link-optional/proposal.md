# Proposal

## Why

Not every case has a public live project: NDA work, closed internal tools and shut-down products have nothing to link to. Today `projectLink` is required (`String` column, required in `CreateCaseDto`), so the author has to invent a placeholder URL.

## What Changes

- `projectLink` becomes optional on `POST /cases`: it may be omitted, like `company` and `teamSize`. When present it is still validated as an `http` or `https` URL of at most 100 characters.
- `PATCH /cases/:slug` keeps accepting `projectLink` as before (all update fields are optional).
- The column `cases.project_link` becomes nullable (new migration, no data change; existing rows keep their value).
- Responses expose `projectLink: string | null`: `null` when the case has no link. This applies to the list item, the detail and the full view.
- **BREAKING (for API clients)**: `projectLink` in `GET /cases`, `GET /cases/:slug` and the full view is now nullable; the frontend must handle `null` (the generated types from `/docs-json` change to `string | null`).
- Swagger: `projectLink` is documented as optional in `CreateCaseDto` and `nullable: true` in the response DTOs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `case-management`: `projectLink` is optional on create; validation applies only when it is sent; the full view returns `null` without a link.
- `case-catalog`: the list item and the detail return `projectLink: null` for a case without a link.
- `api-documentation`: `projectLink` is not required in `CreateCaseDto` and is nullable in the response schemas.

## Impact

- Code: `prisma/contract.prisma`, `src/case/dto/create-case.dto.ts`, `src/case/dto/case-list-item.dto.ts`, `src/case/case.service.ts`, `src/case/case.fixtures.ts`.
- DB: new migration under `migrations/app/` (drop NOT NULL on `project_link`); must be applied by the user (`db:migrate` is denied for Claude).
- Tests: DTO unit tests, serialization spec, service spec, `test/case-management.e2e-spec.ts`, `test/case-catalog.e2e-spec.ts`, `test/api-docs.e2e-spec.ts`.
- Docs: `README.md` / `CLAUDE.md` only if they describe `projectLink` as required (checked during apply).
- Clients: the frontend renders the link conditionally.
