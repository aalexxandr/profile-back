# Spec Delta

## ADDED Requirements

### Requirement: Fail fast when the storage does not answer

If the storage does not answer within its time limit (see `request-timeouts`) while a background is uploaded, `PUT /cases/:slug/background` SHALL respond with `504` and the standard error body and leave the background of the case unchanged.

#### Scenario: Storage does not answer in time

- **WHEN** a case `spectre` has a background and the storage upload times out while a client sends `PUT /cases/spectre/background` with a valid JPEG
- **THEN** the response is `504` with the standard error body and the message `An external service did not respond in time`
- **AND** the case keeps its previous `backgroundImage` and `backgroundBlurImage`
