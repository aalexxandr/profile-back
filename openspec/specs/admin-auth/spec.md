# admin-auth Specification

## Purpose

Defines who may call which routes of the API: every route is closed unless it is declared public, the administrator authenticates with a static bearer token taken from configuration, failures look the same to the caller, and the server refuses to start without a strong enough token.

## Requirements

### Requirement: Routes are closed unless declared public

Every route of the API SHALL require administrator authentication unless it is explicitly declared public. A route added without such a declaration MUST be protected. The public routes are exactly `GET /cases` and `GET /cases/:slug`; the documentation endpoints (`/docs`, `/docs-json`) are not part of the API routes and stay open.

#### Scenario: Public read needs no token

- **WHEN** a client sends `GET /cases` or `GET /cases/spectre` without an `Authorization` header
- **THEN** the response is not `401` (it is `200`, or `404` for an unknown or unpublished case)

#### Scenario: Write route needs a token

- **WHEN** a client sends `POST /cases` with a valid body and without an `Authorization` header
- **THEN** the response is `401`
- **AND** no case is created

#### Scenario: Undeclared route is protected by default

- **WHEN** a route is added without declaring it public and a client calls it without a token
- **THEN** the response is `401`

### Requirement: Authenticate with a bearer admin token

A request SHALL be treated as made by the administrator only when it carries the header `Authorization: Bearer <token>` and `<token>` equals the configured administrator token. The comparison MUST NOT reveal through its timing how much of a guess is correct or what length the token has. The scheme name `Bearer` MUST be matched case-insensitively.

#### Scenario: Valid token

- **WHEN** a client sends `DELETE /cases/spectre` for an existing case with `Authorization: Bearer <configured token>`
- **THEN** the request is processed normally (`204` here)

#### Scenario: Wrong token

- **WHEN** a client sends `POST /cases` with `Authorization: Bearer wrong-token`
- **THEN** the response is `401`

#### Scenario: Token of a different length

- **WHEN** a client sends a protected request with a token that is a prefix of the configured one, or the configured one with extra characters appended
- **THEN** the response is `401`

#### Scenario: Wrong scheme

- **WHEN** a client sends a protected request with `Authorization: Basic <configured token>`
- **THEN** the response is `401`

#### Scenario: Empty or malformed header

- **WHEN** a client sends a protected request with `Authorization: Bearer` (no token), with an empty `Authorization` header, or with only the token and no scheme
- **THEN** the response is `401`

### Requirement: Unauthenticated requests get a uniform 401

A request rejected for missing or invalid credentials SHALL receive `401` with the standard error body (`status`, `message`, `timestamp`, `path`). The response MUST be the same for a missing token and a wrong token, and MUST NOT include the configured token or any hint about it. The API MUST NOT answer `403`, as there is a single administrator role.

#### Scenario: Missing and wrong token look the same

- **WHEN** a client sends a protected request without a token, and another sends one with a wrong token
- **THEN** both responses have status `401` and the same `message`
- **AND** the body contains the keys `status`, `message`, `timestamp` and `path`

### Requirement: Authenticate before processing the request

Authentication SHALL be decided before the request body is validated or a file upload is read. An unauthenticated request MUST get `401` even when its body is invalid, and an unauthenticated upload MUST NOT be processed or stored.

#### Scenario: Invalid body without a token

- **WHEN** a client sends `POST /cases` with an invalid body and no token
- **THEN** the response is `401`, not `400`

#### Scenario: Unauthenticated upload is not stored

- **WHEN** a client sends `PUT /cases/spectre/image` with a valid JPEG and no token
- **THEN** the response is `401`
- **AND** nothing is written to the storage and the case is unchanged

### Requirement: Administrator token is mandatory configuration

The administrator token SHALL be read from the environment variable `ADMIN_TOKEN` at startup. The application MUST refuse to start when the variable is missing, empty, or shorter than 32 characters, so that a deployment can never run with the write routes open or guarded by a trivially guessable token. The token MUST NOT be written to logs or error responses.

#### Scenario: Token missing

- **WHEN** the application starts without `ADMIN_TOKEN`
- **THEN** startup fails with an error naming the variable

#### Scenario: Token too short

- **WHEN** the application starts with `ADMIN_TOKEN` of 31 characters
- **THEN** startup fails with an error naming the variable and the minimum length

#### Scenario: Token long enough

- **WHEN** the application starts with `ADMIN_TOKEN` of 32 or more characters
- **THEN** startup succeeds and requests with that token are authenticated
