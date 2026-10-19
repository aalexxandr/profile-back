import { createHash, timingSafeEqual } from 'node:crypto';

/** `Authorization: Bearer <token>`: one space, a token without whitespace. */
const BEARER = /^Bearer ([^\s]+)$/i;

/** The token of a `Bearer` header, or `undefined` for anything else. */
export function extractBearerToken(header: string | undefined) {
  return BEARER.exec(header ?? '')?.[1];
}

/** Hashing first gives equal-length buffers, so the length of a token never leaks. */
export function digestToken(token: string) {
  return createHash('sha256').update(token).digest();
}

/** Constant-time comparison of a presented token with the expected digest. */
export function isSameToken(presented: string, expected: Buffer) {
  return timingSafeEqual(digestToken(presented), expected);
}
