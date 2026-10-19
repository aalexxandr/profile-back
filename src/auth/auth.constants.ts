/** Metadata key that `@Public()` sets and `AdminGuard` reads. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Environment variable that holds the admin token. */
export const ADMIN_TOKEN_ENV = 'ADMIN_TOKEN';

/** The app refuses to start with a shorter token (`openssl rand -hex 32` gives 64). */
export const MIN_ADMIN_TOKEN_LENGTH = 32;
