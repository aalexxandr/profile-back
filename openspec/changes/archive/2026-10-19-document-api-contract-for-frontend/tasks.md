# Tasks

## 1. Generator-ready document

- [x] 1.1 Add e2e scenarios to `test/api-docs.e2e-spec.ts` for the three new scenarios (OpenAPI 3 version, all `$ref` resolve, no empty schemas); run `pnpm test:e2e --runInBand test/api-docs.e2e-spec.ts` and confirm they run without a DB
- [x] 1.2 Prove the tests can fail: locally add a temporary empty DTO or a dangling reference, confirm the new tests are red for the right reason, then revert; if the document needs a real fix, apply the minimal change and re-run until green
- [x] 1.3 Run `pnpm run lint` and `pnpm run typecheck` and confirm no errors in the new test code

## 2. Documentation

- [x] 2.1 Add the README subsection "Контракт API для фронтенда" (in Russian, next to "API кейсов"): `/docs-json` as the spec source, an example `openapi-typescript` command with the URL taken from a variable (default `http://localhost:3000/docs-json`), the rules (commit the generated file, never edit by hand), and the note that `/docs-json` is always public; verify by checking that the documented URL returns the document on a locally running backend
- [x] 2.2 Add one sentence to the Swagger section of `CLAUDE.md` stating that `/docs-json` is the type source for the frontend; verify the wording is in English and consistent with the surrounding text

## 3. Final check

- [x] 3.1 Run `pnpm run check` and `pnpm run format:check` and confirm both are green
