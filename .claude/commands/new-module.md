---
description: Create a new NestJS feature module following project conventions (argument — module name)
argument-hint: <module-name>
---

Create the feature module `$ARGUMENTS` in `src/$ARGUMENTS/` modeled on `src/case/` (read `src/case/CLAUDE.md` and the module files first):

1. Work in TDD order: write the failing tests first (see step 4), then the code that makes them pass.
2. `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/create-<name>.dto.ts` with class-validator.
3. If a new table is needed: add the model to `prisma/contract.prisma`, run `pnpm run db:generate`, and add a getter to `src/prisma/prisma.service.ts`. Don't run migrations or `db:update`/`db:migrate`; suggest the commands to the user.
4. Register the module in `src/app.module.ts`.
5. Tests per the `writing-tests` skill: DTO unit test (boundary values), service unit tests if it has logic, and e2e for the endpoints modeled on `test/app-setup.e2e-spec.ts` (with DB if real Prisma is needed; run e2e only when the local DB is available).
6. Run `pnpm run check`.
7. If the architecture changed (new module), update `CLAUDE.md` and `README.md`.
