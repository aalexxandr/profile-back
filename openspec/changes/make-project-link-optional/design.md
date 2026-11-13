# Design

## Context

`projectLink` is a required `String` column (`cases.project_link`), a required field of `CreateCaseDto` (`@IsString @IsNotEmpty @IsUrl @MaxLength(100)`) and a non-null `string` in `CaseListItemDto`; `CaseDetailDto` extends it and `CaseFullDto` is derived from the detail, so one response change covers all three views. `UpdateCaseDto` is `PartialType` of the create DTO, so it follows the create DTO automatically. `company` is the existing precedent for an optional language-independent field: nullable column, `@IsOptional`, `?? null` in the service, `nullable: true` in the response DTO. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- `projectLink` behaves exactly like `company`: optional on create, `null` in responses when absent.
- The existing URL validation stays for any value that is sent.

**Non-Goals:**

- Clearing an existing link through `PATCH` (sending `null`). `company` cannot be cleared either; the update path would need explicit null handling for both fields and is a separate change. A client that must remove a link recreates the case or waits for that change.
- Requiring a link for published cases.
- Any change to translations, pictures or the list ordering.

## Decisions

- **Nullable column, no default.** `project_link` becomes `String?` and the migration only drops NOT NULL; existing rows keep their value. Alternative: an empty string as "no link". Rejected: it is a magic value, passes `@IsNotEmpty` nowhere, and forces clients to check for `''` as well as `null`; `company` already uses `null`.
- **`@IsOptional()` before the existing validators.** `@IsOptional` skips all validators for `undefined` and `null`, so `null` in a POST body is accepted like an omitted field (same as `company`). An empty string still fails `@IsNotEmpty` (spec scenario "Empty link").
- **Service stores `caseData.projectLink ?? null`**, mirroring `company`. `updateCase` already passes only the fields present in the body, so an omitted `projectLink` leaves the column unchanged (spec "Keep the link of a case on update").
- **Response DTO: `type: String, nullable: true`** with `projectLink!: string | null`. Both the TypeScript type and the OpenAPI schema change, which is what the frontend generator reads. The key stays required in the schema because it is always present in the response.
- **Migration via the Prisma 8 flow** (`db:migration:plan --name make-project-link-optional` → `db:migrate` → `db:verify`). Claude cannot run DB-mutating commands; the user runs them (see Migration Plan).

Test levels:

| Behavior                                                                                        | Level                                                       | Mocks                                                         |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| `projectLink` omitted is valid, `""` / `ftp://` / `null`-handling rejected or accepted per spec | unit (`create-case.dto.spec.ts`, `update-case.dto.spec.ts`) | none                                                          |
| Response serialization with `projectLink: null` (list, detail, full)                            | unit (`case-serialization.spec.ts`)                         | none                                                          |
| Service writes `null` when the link is omitted                                                  | unit (`case.service.spec.ts`)                               | `PrismaService`                                               |
| Create without link, add a link by PATCH, list and detail return `null`                         | e2e (`case-management`, `case-catalog`)                     | `StorageService` replaced by `InMemoryStorage`; real local DB |
| Swagger: not required in `CreateCaseDto`, nullable and required in response schemas             | e2e without DB (`api-docs`)                                 | none                                                          |

## Risks / Trade-offs

- [API clients and generated types now see `string | null`] → called out as BREAKING in the proposal; the frontend renders the link conditionally. The field stays present in the response, so no key-existence checks break.
- [Migration must reach the DB before the new code is deployed, otherwise creating a case without a link fails with a NOT NULL violation → `500`] → apply the migration first; it is backward compatible with the old code (the old code always sends a link).
- [Link cannot be removed once set] → accepted, see Non-Goals.

## Migration Plan

1. `pnpm run db:migration:plan --name make-project-link-optional`, review `migrations/app/<timestamp>_make_project_link_optional/` (an `alterColumn` dropping NOT NULL, nothing else).
2. `pnpm run db:migrate`, then `pnpm run db:verify` (run by the user).
3. Deploy the application after the migration.

Rollback: the migration is reversible only while no row has `project_link IS NULL`; otherwise those rows must get a value first, then NOT NULL can be restored.
