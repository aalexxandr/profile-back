# Test conventions

- Unit tests: `*.spec.ts` next to the code; e2e: `test/*.e2e-spec.ts` (config `test/jest-e2e.json`, run with `pnpm run test:e2e --runInBand`).
- E2E boots the app via `configureApp()` from `src/app.setup.ts` to match production (ValidationPipe, filters, middleware).
- TDD: write the test before the code. First a red test (make sure it fails for the right reason), then minimal code to green, then refactor. Tests go in the same change as the code. How to write tests: the `writing-tests` skill.
- Two kinds of e2e: **without DB** (own stub `controllers`/`providers` on top of `configureApp()`, example `test/app-setup.e2e-spec.ts`) and **with DB** (whole `AppModule`). Prefer no-DB when a real Prisma query doesn't matter.
- DB e2e uses the real local DB: data is created with a unique value and deleted at the end. The schema must already be applied. Never run against a production DB (`assertSafeDatabase` blocks it).
- Logs are silenced in e2e; `DEBUG_TESTS=1 pnpm run test:e2e --runInBand` brings them back (see `test/setup-e2e.ts`).
- Coverage: `pnpm run test:cov` (unit only, thresholds in `package.json`, checked in CI). Stubs, `case/**` and files covered by e2e are excluded; when a stub gains logic, remove it from `collectCoverageFrom`.
- Examples: `src/filters/all-exeption.filter.spec.ts`, `src/prisma/prisma.service.spec.ts`, `test/app-setup.e2e-spec.ts`. The `case` module is a throwaway sample and will be removed: no tests for it.
- Helpers in `test/helpers/`: `createTestApp({...})` (app via `configureApp()`; close it in `afterAll`), `assertSafeDatabase` (e2e won't start if `POSTGRES_URI` is not local), `uniqueId(prefix, maxLength)` (unique data).
- DB e2e cleanup: delete only your own records (by the `uniqueId` value) in `afterAll` via `app.get(PrismaService)`, then `app.close()`. No shared cleanup helper until there is a second model.
