# Spec Delta

## MODIFIED Requirements

### Requirement: Stay consistent when the storage fails

If the storage rejects the upload, the API SHALL respond with the standard generic `500` and leave the case unchanged. If the storage does not answer within its time limit (see `request-timeouts`), the API SHALL respond with `504` and the standard error body and leave the case unchanged. If saving the case fails after the object was uploaded, the newly uploaded object MUST be removed on a best-effort basis, unless it is the same object the case already uses.

#### Scenario: Storage is unavailable

- **WHEN** the storage fails while a client uploads a valid picture
- **THEN** the response is `500` with the standard error body and the case keeps its previous `image` and `blurImage`

#### Scenario: Storage does not answer in time

- **WHEN** a case `spectre` has an image and the storage upload times out while a client sends `PUT /cases/spectre/image` with a valid JPEG
- **THEN** the response is `504` with the standard error body and the message `An external service did not respond in time`
- **AND** the case keeps its previous `image` and `blurImage`
