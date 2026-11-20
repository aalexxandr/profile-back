## ADDED Requirements

### Requirement: Describe the nullable project link in responses

The response schemas that carry `projectLink` (the list item, the detail and the full view) SHALL document it as a nullable string, and keep it among their required properties, since the key is always present.

#### Scenario: Link is nullable in every response schema

- **WHEN** a client requests `GET /docs-json`
- **THEN** `projectLink` in `CaseListItemDto`, `CaseDetailDto` and `CaseFullDto` is a `string` with `nullable: true`
- **AND** `projectLink` is listed as required in each of these schemas
