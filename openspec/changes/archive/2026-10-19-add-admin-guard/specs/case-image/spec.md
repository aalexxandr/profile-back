## ADDED Requirements

### Requirement: Image management requires the admin token

`PUT /cases/:slug/image` and `DELETE /cases/:slug/image` SHALL require the administrator token (see `admin-auth`) and respond `401` without a valid one. A rejected request MUST NOT read or process the uploaded file, write to the storage, or change the case.

#### Scenario: Upload without a token

- **WHEN** a case `spectre` exists and a client sends `PUT /cases/spectre/image` with a valid JPEG and no `Authorization` header
- **THEN** the response is `401`
- **AND** nothing is written to the storage and `image` of the case is unchanged

#### Scenario: Upload with a wrong token

- **WHEN** a client sends `PUT /cases/spectre/image` with a valid JPEG and `Authorization: Bearer wrong-token`
- **THEN** the response is `401`

#### Scenario: Removal without a token

- **WHEN** a case `spectre` has a picture and a client sends `DELETE /cases/spectre/image` with no token
- **THEN** the response is `401` and the picture and its stored object are still there

#### Scenario: Upload with the token

- **WHEN** a client sends `PUT /cases/spectre/image` with a valid JPEG and the valid token
- **THEN** the response is `200` as described for uploads
