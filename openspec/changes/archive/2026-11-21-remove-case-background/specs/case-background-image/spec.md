## REMOVED Requirements

### Requirement: Upload a case background

**Reason**: The frontend no longer shows a background on the case page; the feature leaves the product.
**Migration**: None. `PUT /cases/:slug/background` now answers `404`; the case picture (`PUT /cases/:slug/image`) is unaffected.

### Requirement: Process the background like the case picture

**Reason**: There is no background to process any more.
**Migration**: None. The picture keeps these rules (see `case-image`).

### Requirement: Store the background separately from the picture

**Reason**: The background columns are dropped and no new background object is ever stored.
**Migration**: The operator removes leftover objects under `cases/*/background/` from the bucket by hand (see README).

### Requirement: Remove a case background

**Reason**: There is no background to remove.
**Migration**: None. `DELETE /cases/:slug/background` now answers `404`.

### Requirement: Background routes require the admin token

**Reason**: The routes no longer exist.
**Migration**: None.

### Requirement: Fail fast when the storage does not answer

**Reason**: The background upload no longer exists; the picture upload keeps its own `504` rule (see `case-image`, `request-timeouts`).
**Migration**: None.
