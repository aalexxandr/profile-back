import { ConflictException } from '@nestjs/common';

import { toHttpException } from './database-error';

// Prisma 8 surfaces a constraint violation as an error carrying `sqlState`.
const dbError = (sqlState: string, message = 'database error') =>
  Object.assign(new Error(message), { sqlState });

describe('toHttpException', () => {
  it('turns a unique violation (23505) into a ConflictException', () => {
    const result = toHttpException(dbError('23505'));

    expect(result).toBeInstanceOf(ConflictException);
  });

  it('uses a generic message without database details', () => {
    const result = toHttpException(
      dbError('23505', 'duplicate key value violates "cases_pkey"'),
    ) as ConflictException;

    expect(result.message).toBe('Resource already exists');
  });

  it.each([
    ['an ordinary Error', new Error('boom')],
    ['a database error with another sqlState', dbError('23503')],
    ['a string', 'just a string'],
    ['null', null],
    ['undefined', undefined],
  ])('returns %s unchanged', (_name, value) => {
    expect(toHttpException(value)).toBe(value);
  });
});
