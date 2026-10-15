---
description: Run typecheck, lint and tests, fix any errors found
allowed-tools: Bash(pnpm run check), Bash(pnpm run lint:fix), Bash(pnpm run format), Bash(pnpm run typecheck), Bash(pnpm test*)
---

Run `pnpm run check` (typecheck, lint and unit tests; e2e is not included and runs separately: `pnpm run test:e2e --runInBand`, needs the local DB if the test uses it). If there are errors:

1. First `pnpm run lint:fix` and `pnpm run format` for anything auto-fixable.
2. Fix the rest by hand in the code, without disabling rules or loosening tsconfig.
3. Repeat `pnpm run check` until green.

At the end, briefly list what was fixed. If an error can't be fixed without a decision from the user, stop and ask.
