# case-management Specification

## MODIFIED Requirements

### Requirement: Delete a case

`DELETE /cases/:slug` SHALL remove an existing case, whether published or not, and respond `204`. If the case has a stored picture, the stored object MUST be removed as well.

#### Scenario: Delete an existing case

- **WHEN** a case `spectre` exists and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and `GET /cases/spectre` returns `404`

#### Scenario: Delete a case that has a picture

- **WHEN** a case `spectre` has a stored picture and a client sends `DELETE /cases/spectre`
- **THEN** the response is `204` and the stored object of the picture no longer exists

#### Scenario: Delete an unknown case

- **WHEN** a client sends `DELETE /cases/does-not-exist`
- **THEN** the response is `404`
