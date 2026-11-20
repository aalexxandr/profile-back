# request-timeouts Specification

## Purpose

Bounds how long the API waits for an incoming request and for calls to external services, so a slow or unreachable dependency produces a prompt error instead of a hanging connection.

## Requirements

### Requirement: Bound the time of an incoming request

The API SHALL answer every incoming request within the request time limit (30 seconds). A request whose handling is not finished within the limit MUST receive `503` with the standard error body (`status`, `message`, `timestamp`, `path`) and the message `Request timed out`. A request that finishes within the limit MUST be answered as before.

#### Scenario: Handler exceeds the limit

- **WHEN** the request time limit is set to 50 ms and a client calls a route whose handler resolves after 200 ms
- **THEN** the response is `503` with the standard error body, `message` equal to `Request timed out` and `path` equal to the requested path

#### Scenario: Handler finishes in time

- **WHEN** the request time limit is set to 200 ms and a client calls a route whose handler resolves after 10 ms with `{ "ok": true }`
- **THEN** the response is `200` with the body `{ "ok": true }`

#### Scenario: Errors inside the limit are unchanged

- **WHEN** a client calls a route whose handler throws a `404` within the limit
- **THEN** the response is `404`, not `503`

### Requirement: Bound the time of a call to an external service

Every call to an external service (currently the object storage) SHALL be limited in time (10 seconds for the storage), and the limit MUST be shorter than the request time limit. A call that does not finish within its limit MUST be cancelled, and the request that made it MUST be answered with `504` and the standard error body with the message `An external service did not respond in time`. The message MUST NOT reveal the address or the name of the service.

#### Scenario: Storage call exceeds its limit

- **WHEN** the storage time limit is set to 50 ms and a storage upload has not finished after 50 ms
- **THEN** the upload fails with a `504` error whose message is `An external service did not respond in time`
- **AND** the pending storage request is cancelled

#### Scenario: Storage call finishes in time

- **WHEN** the storage time limit is set to 200 ms and a storage upload finishes after 10 ms
- **THEN** the upload succeeds and no timeout error is raised

#### Scenario: Storage error inside the limit is not a timeout

- **WHEN** a storage upload fails with an error within its limit
- **THEN** that same error is raised, not the `504` timeout error
