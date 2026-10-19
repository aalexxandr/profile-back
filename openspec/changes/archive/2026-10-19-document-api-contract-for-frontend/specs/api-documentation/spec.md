# Spec Delta

## ADDED Requirements

### Requirement: Document is consumable by code generators

The document served at `GET /docs-json` SHALL be a valid JSON OpenAPI 3.x document that a client code generator can process without outside input: its `openapi` field MUST start with `3.`, every internal `$ref` MUST point to an existing entry in `components.schemas`, and every schema in `components.schemas` MUST declare at least one property.

#### Scenario: Document is OpenAPI 3

- **WHEN** a client requests `GET /docs-json`
- **THEN** the response status is `200`, the body is JSON and its `openapi` field starts with `3.`

#### Scenario: Every reference resolves

- **WHEN** a client requests `GET /docs-json` and collects every `$ref` of the form `#/components/schemas/<Name>` found anywhere in the document
- **THEN** each `<Name>` exists as a key of `components.schemas`

#### Scenario: No empty schemas

- **WHEN** a client requests `GET /docs-json`
- **THEN** every schema in `components.schemas` has a `properties` object with at least one key
