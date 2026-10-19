# Proposal

## Why

The frontend (a separate repository) will generate its TypeScript types from the backend's OpenAPI document (`GET /docs-json`) instead of writing them by hand. Today nothing guarantees the document is usable by a code generator (valid OpenAPI 3, no dangling `$ref`, no empty schemas), and nothing in the repo tells a frontend developer that `/docs-json` is the contract source or how to consume it.

## What Changes

- Add a requirement to the `api-documentation` spec: the document served at `/docs-json` is a self-contained OpenAPI 3 document that a generator can consume (version 3.x, every `$ref` resolves, no schema without properties).
- Add a regression test for it in `test/api-docs.e2e-spec.ts` (no DB needed).
- Add a README section "Контракт API для фронтенда": where the spec lives, the generation command with a configurable URL (default `http://localhost:3000/docs-json`), and the rules (commit the generated file, never edit it by hand, `/docs-json` is always public).
- Add one sentence to `CLAUDE.md` (Swagger section): `/docs-json` is the type source for the frontend, so its accuracy is part of the contract.
- No runtime code changes, no new dependencies, no new scripts. The generation itself lives in the frontend repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-documentation`: adds a requirement that the served document is machine-consumable by OpenAPI code generators.

## Impact

- `test/api-docs.e2e-spec.ts`: new scenarios.
- `README.md`, `CLAUDE.md`: documentation only.
- `openspec/specs/api-documentation/spec.md`: updated at archive.
- Frontend repository (out of scope here): adds `openapi-typescript`, a `gen:api` script and the generated `schema.d.ts`.
