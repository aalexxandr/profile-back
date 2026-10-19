## ADDED Requirements

### Requirement: Management requires the admin token

`POST /cases`, `PATCH /cases/:slug` and `DELETE /cases/:slug` SHALL require the administrator token (see `admin-auth`) and respond `401` without a valid one. A rejected request MUST NOT create, change or delete anything. Reading the catalog (`GET /cases`, `GET /cases/:slug`) stays public.

#### Scenario: Create without a token

- **WHEN** a client sends `POST /cases` with a valid body and no `Authorization` header
- **THEN** the response is `401` and the case does not exist afterwards

#### Scenario: Update without a token

- **WHEN** a case `spectre` exists and a client sends `PATCH /cases/spectre` with `{ "name": "Hacked" }` and no token
- **THEN** the response is `401` and the `name` of the case is unchanged

#### Scenario: Delete with a wrong token

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre` with `Authorization: Bearer wrong-token`
- **THEN** the response is `401` and `GET /cases/spectre` still returns the case (if published)

#### Scenario: Unauthenticated request for an unknown case

- **WHEN** a client sends `PATCH /cases/does-not-exist` with no token
- **THEN** the response is `401`, not `404`, so the existence of a case is not revealed

#### Scenario: Public read stays open

- **WHEN** a client sends `GET /cases` with no token
- **THEN** the response is `200`
