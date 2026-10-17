# Feature module conventions (using `case/` as the example)

- Layers: `*.controller.ts` (routing only, no logic) → `*.service.ts` → `PrismaService`. The controller never touches the DB directly.
- DTOs live in `dto/`: classes with class-validator decorators and `!` on fields. The global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) is set up in `configureApp()`, so a field without a decorator is rejected. Enums come from `src/prisma/enums.ts`.
- New DB model: add it to `prisma/contract.prisma`, run `pnpm run db:generate`, then add a getter to `src/prisma/prisma.service.ts` (like `get cases()`).
- Queries use the Prisma 8 ORM style: `.create({...})`, `.first({ slug })`, `.where({ published: true }).orderBy([row => row.sortOrder.asc(), row => row.createdAt.desc()]).all()`. Don't use the old `findMany({ where })` shape.
- Register the module in `AppModule`; import `PrismaModule` wherever DB access is needed.
- Imports are sorted automatically (`simple-import-sort`); unused ones are removed by the linter.
- The service returns database rows (`CaseRow` in `case.types.ts`); the response shape is set by the controller: `@SerializeOptions({ type: CaseListItemDto | CaseDetailDto, strategy: 'excludeAll' })` plus the global `ClassSerializerInterceptor` from `configureApp()`. Only fields marked `@Expose()` in the response DTOs reach the client, so a new field must get `@Expose()` (and `@ApiProperty`, there is no Swagger plugin), otherwise it silently disappears. Dates are flat `startedAt` / `endedAt`. The shape is covered by `dto/case-serialization.spec.ts` and the e2e key lists.
- Public reads filter `published: true`; an unknown and an unpublished slug give the same `404`. Writes (`PATCH`, `DELETE`) ignore `published`.
- Update/delete use `.whereUnique({ slug }).update(...)` / `.delete()`, which return `null` when no row matches (map that to `NotFoundException`). Do not catch database errors in the service: a duplicate slug (unique violation) is translated to `409` by the global `AllExceptionFilter` (see "Error handling" in the root `CLAUDE.md`). `undefined` fields in `update` are left unchanged, `null` clears.
- `UpdateCaseDto` is `PartialType(OmitType(CreateCaseDto, ['slug']))` from `@nestjs/swagger`; `slug` is immutable.
- Test fixtures for rows live in `case.fixtures.ts` (excluded from coverage).
- Swagger documentation is mandatory for every endpoint and DTO field of this module (see "API documentation (Swagger)" in the root `CLAUDE.md`): operation text, `@ApiParam`, all response statuses with `ErrorResponseDto`, `@ApiProperty` with description, example and constraints. `test/api-docs.e2e-spec.ts` fails if a request schema is empty or an error status is undocumented.
