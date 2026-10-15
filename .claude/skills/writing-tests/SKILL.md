---
name: writing-tests
description: Write and update automated tests (unit and e2e) for this NestJS project following its conventions. Use when adding new functionality, a DTO, endpoint, filter or pipe, when fixing a bug, and when asked to write, extend or repair tests.
---

# Writing tests in profile-back

The `case` module is a throwaway sample and will be removed: don't write tests for it and don't rely on it in examples. Layout conventions: `test/CLAUDE.md`.

## Examples (follow their style)

| What you write                                      | Example                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| unit: filter, pipe, guard, `ArgumentsHost` mock     | `src/filters/all-exeption.filter.spec.ts`          |
| unit: middleware                                    | `src/common/middlewares/logger.middleware.spec.ts` |
| unit: service with a mocked external module         | `src/prisma/prisma.service.spec.ts`                |
| e2e without DB (stub controller + `configureApp()`) | `test/app-setup.e2e-spec.ts`                       |
| helper tests                                        | `test/helpers/helpers.e2e-spec.ts`                 |

Helpers: `test/helpers/create-test-app.ts`, `assert-safe-database.ts`, `unique-id.ts`.

## Step 0. Decide whether a test is needed

A test is needed when behavior changes:

- new or changed endpoint → e2e;
- new or changed DTO / validation rules → unit;
- logic in a service, filter, pipe, guard, interceptor → unit;
- bug fix → first a test that reproduces the bug (it is red), then the fix.

Workflow is TDD (red → green → refactor):

1. **Red:** write one test for the expected behavior and run it. It must fail for the right reason (wrong result or status), not because of a compile error or typo. If it needs a symbol that doesn't exist yet, create an empty stub first.
2. **Green:** write the minimum code to make the test pass. Don't add behavior that isn't covered by a test.
3. **Refactor:** improve the code while tests are green, re-running them after each step.
4. Repeat, one behavior per cycle.

A test is not needed for docs and config edits, renames without behavior change, or empty stubs. If you skip a test where one is appropriate, tell the user and say why.

## Step 1. Pick the level

| What we check                                               | Level | File                                     |
| ----------------------------------------------------------- | ----- | ---------------------------------------- |
| DTO, filter, pipe, pure function, service with branching    | unit  | `src/<path>/<name>.spec.ts` next to code |
| Whole endpoint (validation, controller, DB, error response) | e2e   | `test/<module>.e2e-spec.ts`              |

A thin pass-through service over Prisma gets no separate unit test: we don't mock the Prisma 8 ORM chain (`.orderBy(...).all()`); e2e against a real DB covers it.

## Step 2. Write the test

General rules:

- The name describes behavior: `returns 404 when the case is not found`. One test checks one thing.
- Arrange / Act / Assert structure. Tests are independent and don't rely on order.
- Build data with a factory plus overrides (`validItem({ name: '' })`) instead of copying whole objects.
- No `any`, `eslint-disable`, or `it.skip` without a reason. Unused arguments start with `_`. ESLint is strict (`no-floating-promises`, `no-unsafe-argument`): `await` every promise.
- Don't weaken assertions to get a green test. If a test exposes a bug in the code, fix the code or tell the user.

### Unit: DTO

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateItemDto } from './create-item.dto'; // example name, substitute your own

// valid-object factory: each test changes one field
const validItem = (overrides: Record<string, unknown> = {}) => ({
  name: 'Name',
  tags: ['nestjs'],
  ...overrides,
});

const errorsFor = (data: object) =>
  validate(plainToInstance(CreateItemDto, data));

it.each([
  ['name too long', { name: 'a'.repeat(101) }],
  ['empty tags list', { tags: [] }],
])('rejects: %s', async (_name, overrides) => {
  expect(await errorsFor(validItem(overrides))).not.toHaveLength(0);
});
```

Typical strict-ESLint traps (rule: don't disable, fix the code):

- type your mocks: `jest.fn<ReturnType, [ArgType]>()` (that's the signature in the project's `@types/jest`), not a bare `jest.fn()` with `any`;
- cast `expect.any(String)`: `expect.any(String) as string`;
- don't pass an object method to `expect(obj.method)` (`unbound-method` rule): keep the mock in a separate variable;
- `await` every promise, close the app in `afterAll`.

For boundary values check both sides: the maximum passes, maximum + 1 doesn't.

### Unit: filter, pipe, guard

Mock only the external boundary (`ArgumentsHost`, `Response`, `PrismaService`). Silence the logger: `jest.spyOn(Logger.prototype, 'error').mockImplementation()`. For services build the module with `Test.createTestingModule` and `{ provide: PrismaService, useValue: {...} }`, typing the mock rather than casting to `any`.

### E2E

Skeleton (DB e2e; without a DB pass your own `controllers`/`providers`, see `test/app-setup.e2e-spec.ts`):

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

describe('Items (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  const id = uniqueId('e2e'); // unique value for the test's data

  beforeAll(async () => {
    // createTestApp calls configureApp() and checks that the DB is local
    app = await createTestApp({ imports: [AppModule] });
    server = app.getHttpServer() as typeof server;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    // delete only records with our id via prisma
    await app.close();
  });
});
```

E2E rules:

- Always `createTestApp(...)` (it calls `configureApp()` inside); don't assemble the app by hand.
- Unique data via `uniqueId` (mind field length limits), delete only your own records, close the app in `afterAll`.
- Runs against the real local DB. Never run on production. The schema must be applied; `db:init`, `db:update`, `db:migrate` and `prisma db *` are run by the user, not you (they are denied in `.claude/settings.json`).
- Assert the status and important body fields, not the whole JSON (`createdAt` and the like change).
- For each endpoint at minimum: the happy path, invalid input (400), not found / conflict where applicable.

## Step 3. Run

```bash
pnpm test -- <path-to-file>          # unit
pnpm run test:e2e --runInBand        # e2e (needs the DB)
pnpm run check                       # typecheck + lint + unit, before finishing
```

If e2e can't be run (no DB), tell the user explicitly that e2e was not run, and don't call the work verified.

## Step 4. Wrap up

- Checklist: the test was red before the implementation or fix and green after; no `skip`/`any`; `pnpm run check` is green.
- If the architecture or commands changed, update `CLAUDE.md` and `README.md`.
- Commit in Conventional Commits format: `test(<scope>): ...` or `fix(<scope>): ...` together with the test.
