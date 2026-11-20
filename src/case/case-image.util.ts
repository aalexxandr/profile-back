import { createHash } from 'node:crypto';

/** The storage key of a processed picture: content-addressed, so equal bytes give an equal key. */
export function pictureKey(slug: string, bytes: Buffer): string {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return `cases/${slug}/${hash}.webp`;
}
