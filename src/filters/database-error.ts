import { ConflictException } from '@nestjs/common';

// SQLSTATE codes. Prisma 8 surfaces a database constraint violation as an
// error carrying a `sqlState` property.
const UNIQUE_VIOLATION = '23505';

function sqlStateOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('sqlState' in error)) {
    return undefined;
  }
  return typeof error.sqlState === 'string' ? error.sqlState : undefined;
}

/**
 * Translates known database errors into HTTP exceptions; anything else is
 * returned unchanged. Used by the global `AllExceptionFilter`, so services and
 * controllers never catch database errors themselves. To handle another
 * constraint (e.g. `23502` not-null, `23503` foreign key), add a case here.
 * Messages are generic on purpose: no constraint names or SQL details.
 */
export function toHttpException(exception: unknown): unknown {
  switch (sqlStateOf(exception)) {
    case UNIQUE_VIOLATION:
      return new ConflictException('Resource already exists');
    default:
      return exception;
  }
}
