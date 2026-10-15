# Feature module conventions (using `case/` as the example)

- Layers: `*.controller.ts` (routing only, no logic) → `*.service.ts` → `PrismaService`. The controller never touches the DB directly.
- DTOs live in `dto/`: classes with class-validator decorators and `!` on fields. The global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) is set up in `configureApp()`, so a field without a decorator is rejected. Enums come from `src/prisma/enums.ts`.
- New DB model: add it to `prisma/contract.prisma`, run `pnpm run db:generate`, then add a getter to `src/prisma/prisma.service.ts` (like `get cases()`).
- Queries use the Prisma 8 ORM style: `.create({...})`, `.first({ slug })`, `.orderBy(row => row.createdAt.desc()).all()`. Don't use `findMany`/`where`.
- Register the module in `AppModule`; import `PrismaModule` wherever DB access is needed.
- Imports are sorted automatically (`simple-import-sort`); unused ones are removed by the linter.
