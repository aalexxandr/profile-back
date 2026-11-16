# Proposal

## Why

A case's `role` can only be `FRONTEND` or `FULLSTACK`. The author also works as a product engineer, and no existing value describes that role, so such cases are mislabeled. The frontend needs a third value it can show as "Product Engineer".

## What Changes

- Add the value `PRODUCT` to the `Role` native enum in the Postgres schema (`prisma/contract.prisma`) with a committed migration (`ALTER TYPE ... ADD VALUE`).
- `POST /cases` and `PATCH /cases/:slug` accept `role: "PRODUCT"`; any value outside `FRONTEND`, `FULLSTACK`, `PRODUCT` is still rejected with `400`.
- `GET /cases/:slug`, and the create, update and image responses, return `role: "PRODUCT"` for such cases (the list `GET /cases` has no `role`, unchanged).
- Swagger lists `FRONTEND`, `FULLSTACK` and `PRODUCT` as the `role` enum in `CreateCaseDto`, `UpdateCaseDto` and `CaseDetailDto`, so the frontend's generated types get the new value.
- Existing rows and the existing two values are unchanged. The API stores and returns the enum key; the label "Product Engineer" is chosen by the frontend, not by the backend (assumption: the API does not return display labels).
- After implementation, hand the frontend a short summary of how the field works and what it accepts.

No **BREAKING** changes: the enum only grows. A frontend with an exhaustive `switch` over `role` must add the new case.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `case-management`: new requirement that `role` accepts exactly `FRONTEND`, `FULLSTACK` and `PRODUCT`.
- `api-documentation`: the documented `role` enum of `CreateCaseDto` lists the third value.

## Impact

- `prisma/contract.prisma`, a new migration under `migrations/` (with its snapshot); the generated contract is not committed.
- `src/case/dto/create-case.dto.ts` and `case-detail.dto.ts` take the values from the generated enum (`src/prisma/enums.ts`), so no hand-written list changes; the Swagger description may mention the new value.
- Tests: `src/case/dto/create-case.dto.spec.ts`, `test/case-management.e2e-spec.ts`, `test/case-catalog.e2e-spec.ts`, `test/api-docs.e2e-spec.ts`.
- Docs: `README.md` and `src/case/CLAUDE.md` only if they list role values (none found by search).
- The migration must be applied by the user (`db:migrate` is denied to Claude).
- Overlaps with the in-flight change `make-project-link-optional` on the `api-documentation` requirement "Describe request bodies"; this change is written on top of that version, so archive it after that one.
