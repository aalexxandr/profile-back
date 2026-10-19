---
description: Create a new NestJS feature module following project conventions (argument — module name)
argument-hint: <module-name>
---

Create the feature module `$ARGUMENTS` in `src/$ARGUMENTS/` modeled on `src/case/` (read `src/case/CLAUDE.md` and the module files first):

1. Work in TDD order: write the failing tests first (see step 4), then the code that makes them pass.
2. `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/create-<name>.dto.ts` with class-validator.
   Keep one concern per file (root `CLAUDE.md`, "Code structure: one concern per file"): class files hold only the class; constants go to `<name>.constants.ts`, pure helpers to `<name>.util.ts` (with a spec), types to `<name>.types.ts`.
3. If a new table is needed: add the model to `prisma/contract.prisma`, run `pnpm run db:generate`, and add a getter to `src/prisma/prisma.service.ts`. Don't run migrations or `db:update`/`db:migrate`; suggest the commands to the user.
4. Register the module in `src/app.module.ts`.
   Document the API in Swagger as the root `CLAUDE.md` requires (section "API documentation (Swagger)"): `@ApiTags`, `@ApiOperation`, `@ApiParam`, every response status (errors via `@ApiErrorResponse`), `@ApiProperty` on every DTO field; extend `test/api-docs.e2e-spec.ts` first.
5. Tests per the `writing-tests` skill: DTO unit test (boundary values), service unit tests if it has logic, and e2e for the endpoints modeled on `test/app-setup.e2e-spec.ts` (with DB if real Prisma is needed; run e2e only when the local DB is available).
6. Run `pnpm run check`.
7. If the architecture changed (new module), update `CLAUDE.md` and `README.md`.
