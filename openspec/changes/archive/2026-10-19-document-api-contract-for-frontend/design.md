# Design

## Context

`setupSwagger()` (called from `configureApp()`) always publishes the document at `/docs-json`, in every environment. The Swagger decorators are written explicitly (no Nest Swagger plugin), and `test/api-docs.e2e-spec.ts` already checks the document without a DB. See proposal.md for motivation.

The frontend lives in a separate repository (not a monorepo) and will fetch the document by URL, falling back to `http://localhost:3000/docs-json` while the backend is not deployed.

## Goals / Non-Goals

**Goals:**

- Make the "document is usable by a generator" property a tested guarantee.
- Document the contract source for frontend developers in the repo.

**Non-Goals:**

- No `openapi.json` export script, no committed spec file, no CI diff check, no `oasdiff` (the frontend reads the live URL).
- No change to `operationId` naming, CORS, or whether Swagger is enabled in production.
- No generation tooling in this repository.

## Decisions

- **Validate structure, not a library.** The test walks the parsed JSON to collect `$ref` values and checks `components.schemas` keys. Alternative: add an OpenAPI validator dependency (e.g. `@apidevtools/swagger-parser`). Rejected: new dependency for three simple checks.
- **Test level: e2e, no DB.** Extend `test/api-docs.e2e-spec.ts` using the existing `createTestApp` setup and its document-loading helper. Nothing new to mock; the file already runs without a database.
- **Spec lives in `api-documentation`.** The requirement is about the document's content, so it extends the existing capability instead of creating a new one.
- **Docs in README (Russian) plus one CLAUDE.md sentence.** The generation command is documented but not implemented here; the URL is a variable on the frontend side. The README states that `/docs-json` is always public, so closing Swagger in production later means switching the source to a file.

## Risks / Trade-offs

- [The tests may pass immediately because the document is already valid] → Treat them as characterization tests; prove they can fail by temporarily breaking a reference or adding an empty schema locally and seeing red, then reverting.
- [Types reflect the deployed backend, not the branch] → Documented in README: generate from localhost during development, from the deployed URL before release.
- [Public `/docs-json` exposes the API surface, including unprotected write routes until `admin-guard`] → Stated in README; no change in this scope.
