---
description: Write tests for the current changes (argument — optional path or area)
argument-hint: [path-or-area]
---

Write the missing tests for the current changes `$ARGUMENTS` (if no argument, for the whole `git diff` and `git diff --cached`, including new files).

1. Read the skill `.claude/skills/writing-tests/SKILL.md` and `test/CLAUDE.md`, then the examples referenced in the skill.
2. Decide what needs tests (step 0 of the skill). For each changed file decide: unit, e2e, or no test needed (and why).
3. Work in TDD: if the code isn't written yet (new feature or bug), write the test first and make sure it is red for the right reason, and only then implement the code until green. If the code already exists without a test, add the test, temporarily break the behavior (or check against the old version) to confirm the test can fail, then restore it.
4. Follow the examples and use `test/helpers`. The `case` module is a throwaway sample and will be removed: don't write tests for it.
5. Run `pnpm run check`. Run DB e2e (`pnpm run test:e2e --runInBand`) only if the local DB is available; otherwise say plainly that e2e was not run.
6. Briefly list: which tests were added, where tests aren't needed and why, and what couldn't be verified.
