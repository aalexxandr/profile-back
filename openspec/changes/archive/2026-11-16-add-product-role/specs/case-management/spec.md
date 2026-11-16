## ADDED Requirements

### Requirement: Validate role

The API SHALL accept `role` in a create or update body only if it is exactly one of `FRONTEND`, `FULLSTACK` or `PRODUCT` (uppercase, no other spelling). Any other value MUST be rejected with `400`. `role` is required on create and optional on update. The stored value MUST be returned unchanged in the full view and in `GET /cases/:slug`.

#### Scenario: Create a case with the product role

- **WHEN** a client sends `POST /cases` with all required fields and `role: "PRODUCT"`
- **THEN** the response is `201` and `role` is `"PRODUCT"`

#### Scenario: Update the role to product

- **WHEN** a case with `role: "FRONTEND"` exists and a client sends `PATCH /cases/:slug` with `role: "PRODUCT"`
- **THEN** the response is `200` with `role: "PRODUCT"` and the other fields are unchanged

#### Scenario: Product role is visible in the public detail

- **WHEN** a published case has `role: "PRODUCT"` and a client requests `GET /cases/:slug`
- **THEN** the response is `200` with `role: "PRODUCT"`

#### Scenario: Existing values still work

- **WHEN** a client sends `POST /cases` with `role: "FRONTEND"`, and another with `role: "FULLSTACK"`
- **THEN** both responses are `201` and return the submitted role

#### Scenario: Unknown role

- **WHEN** a client sends `POST /cases` with `role: "BACKEND"`
- **THEN** the response is `400`

#### Scenario: Wrong spelling or case

- **WHEN** a client sends `POST /cases` with `role: "product"`, and another with `role: "Product Engineer"`
- **THEN** both responses are `400`

#### Scenario: Update with an unknown role

- **WHEN** a client sends `PATCH /cases/:slug` with `role: "BACKEND"`
- **THEN** the response is `400` and the stored role is unchanged
