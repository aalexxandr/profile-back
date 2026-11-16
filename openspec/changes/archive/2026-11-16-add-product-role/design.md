## Context

`role` is a Postgres native enum `Role` (`FRONTEND`, `FULLSTACK`) declared in `prisma/contract.prisma`. The generated contract exposes it as `Role` in `src/prisma/enums.ts`, and both DTOs use it (`@IsEnum(Role)` in `create-case.dto.ts`, `enum: Role` in `@ApiProperty` of `create-case.dto.ts` and `case-detail.dto.ts`). `UpdateCaseDto` derives from `CreateCaseDto`. So the list of values lives in one place, the schema, and everything else follows after `db:generate`.

## Goals / Non-Goals

**Goals:** accept, store, return and document `PRODUCT` everywhere `role` appears; keep old rows and values working; give the frontend a short summary.

**Non-Goals:** returning display labels (such as "Product Engineer") from the API; renaming or removing existing values; a `BACKEND` value; a role dictionary endpoint.

## Decisions

- **Enum key `PRODUCT`** (not `PRODUCT_ENGINEER`). It matches the requested name and the uppercase style of `FRONTEND` / `FULLSTACK`. The frontend maps `PRODUCT` to the label "Product Engineer"; the API stays label-free like it is for the other two values.
- **Extend the native enum** rather than switching to text plus a check constraint. It keeps the DB-level guard that the previous answer to the user relied on. Postgres `ALTER TYPE ... ADD VALUE` is additive and does not rewrite rows.
- **No hand-written value lists.** DTOs and Swagger read the generated `Role`, so only the schema changes; tests assert the full list so a drift is caught.
- **Migration workflow:** `db:migration:plan --name add_product_role` then `db:migrate` then `db:verify`. Claude's settings deny these, so the user runs them; the migration files and snapshot are committed. An enum value added in a migration cannot be used in the same transaction in Postgres, and this change inserts no rows, so this is not a problem here.
- **Ordering with `make-project-link-optional`:** both change the `api-documentation` requirement "Describe request bodies". This delta is based on the already-edited text of that change, so it must be archived after it.

## Test levels

| Behavior                                                                                               | Level                                                           | Mocks                                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DTO accepts `PRODUCT`, rejects `BACKEND`, `product`, `Product Engineer`                                | unit (`create-case.dto.spec.ts`)                                | none                                                                           |
| Create / update / read a case with `PRODUCT`, `400` on unknown role                                    | e2e (`case-management.e2e-spec.ts`, `case-catalog.e2e-spec.ts`) | real local DB (schema must be migrated), `InMemoryStorage` via `createTestApp` |
| `role` enum is `FRONTEND`, `FULLSTACK`, `PRODUCT` in `CreateCaseDto`, `UpdateCaseDto`, `CaseDetailDto` | e2e without DB (`api-docs.e2e-spec.ts`)                         | none                                                                           |

## Risks / Trade-offs

- **Frontend exhaustiveness:** a frontend that switches over `role` without a default breaks at compile time after regenerating types. Intended; mention it in the summary.
- **Unapplied migration:** if the code is deployed before `db:migrate`, writing `PRODUCT` fails with a DB enum error (`500`). Apply the migration first.
- **Enum values are hard to remove** in Postgres; if `PRODUCT` is later renamed it needs a new migration.

## Open Questions

None blocking. Assumption to confirm: the key is `PRODUCT` and the label lives on the frontend.
