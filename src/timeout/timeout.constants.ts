/** Longest time the API spends on one incoming request before answering 503. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Longest time one storage call may take; must stay below `REQUEST_TIMEOUT_MS`. */
export const STORAGE_TIMEOUT_MS = 10_000;

/** Injection token of the request limit, so tests can shorten it. */
export const REQUEST_TIMEOUT = Symbol('REQUEST_TIMEOUT');

export const REQUEST_TIMEOUT_MESSAGE = 'Request timed out';

/** Generic on purpose: never names the service or its address. */
export const EXTERNAL_TIMEOUT_MESSAGE =
  'An external service did not respond in time';
