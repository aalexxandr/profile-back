/** Name of the admin bearer scheme in the OpenAPI document (see `swagger.config.ts`). */
export const ADMIN_TOKEN_SCHEME = 'admin-token';

/** Description of the `503` every operation can return (global request limit). */
export const REQUEST_TIMEOUT_DOC =
  'The request was not handled within 30 seconds (`Request timed out`)';

/** Description of the `504` of operations that wait for the storage. */
export const STORAGE_TIMEOUT_DOC =
  'The storage did not respond within 10 seconds; the case is unchanged';
