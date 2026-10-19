# Test conventions

- Unit tests: `*.spec.ts` next to the code; e2e: `test/*.e2e-spec.ts` (config `test/jest-e2e.json`, run with `pnpm run test:e2e --runInBand`).
- E2E boots the app via `configureApp()` from `src/app.setup.ts` to match production (ValidationPipe, filters, middleware).
- TDD: write the test before the code. First a red test (make sure it fails for the right reason), then minimal code to green, then refactor. Tests go in the same change as the code. How to write tests: the `writing-tests` skill.
- Two kinds of e2e: **without DB** (own stub `controllers`/`providers` on top of `configureApp()`, example `test/app-setup.e2e-spec.ts`) and **with DB** (whole `AppModule`). Prefer no-DB when a real Prisma query doesn't matter.
- DB e2e uses the real local DB: data is created with a unique value and deleted at the end. The schema must already be applied. Never run against a production DB (`assertSafeDatabase` blocks it).
- Logs are silenced in e2e; `DEBUG_TESTS=1 pnpm run test:e2e --runInBand` brings them back (see `test/setup-e2e.ts`).
- Coverage: `pnpm run test:cov` (unit only, thresholds in `package.json`, checked in CI). Stubs, controllers/modules and files covered by e2e are excluded; when a stub gains logic, remove it from `collectCoverageFrom`.
- Examples: `src/filters/all-exeption.filter.spec.ts`, `src/prisma/prisma.service.spec.ts`, `test/app-setup.e2e-spec.ts`. DB e2e examples: `test/case-catalog.e2e-spec.ts`, `test/case-management.e2e-spec.ts`.
- Helpers in `test/helpers/`: `createTestApp({...})` (app via `configureApp()`; close it in `afterAll`), `assertSafeDatabase` (e2e won't start if `POSTGRES_URI` is not local), `uniqueId(prefix, maxLength)` (unique data).
- Auth: `AdminGuard` is global, so every write request in e2e must send the token: `request(server).post('/cases').set(...adminAuth())` (`test/helpers/admin-auth.ts`). `test/setup-e2e.ts` always overwrites `process.env.ADMIN_TOKEN` with `TEST_ADMIN_TOKEN`, so a real token never reaches a test. A no-DB e2e that needs the guard imports `AuthModule` plus `ConfigModule.forRoot({ isGlobal: true })` (example `test/admin-auth.e2e-spec.ts`); stub apps without `AuthModule` have no guard.
- DB e2e cleanup: delete only your own records (by the `uniqueId` value) in `afterAll` via `app.get(PrismaService)`, then `app.close()`. No shared cleanup helper until there is a second model.
- `test/setup-e2e.ts` replaces the global `structuredClone`: jest exposes Node's native one, which creates objects in another realm, and Prisma 8 then drops column type params (e.g. `pg/enum: typeName must be a string`). Without the replacement, any DB write of an enum column fails under jest (plain Node and production are fine).
- Seed DB e2e data with `PrismaService.cases.create(...)` and clean it with `.whereUnique({ slug }).delete()`; the list endpoint is shared with other rows, so filter results by your own `uniqueId` prefix.
