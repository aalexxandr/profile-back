import { createHash } from 'node:crypto';

import { IMAGE_SLOTS } from './case.constants';
import type { CaseImageSlot, CaseRow } from './case.types';

/** The storage key of a processed picture: content-addressed, so equal bytes give an equal key. */
export function pictureKey(
  slug: string,
  slot: CaseImageSlot,
  bytes: Buffer,
): string {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return `cases/${slug}/${IMAGE_SLOTS[slot].folder}${hash}.webp`;
}

/** The row columns of one picture slot, set to a key and a placeholder (both `null` clears it). */
export function pictureColumns(
  slot: CaseImageSlot,
  key: string | null,
  blur: string | null,
): Partial<CaseRow> {
  const { keyColumn, blurColumn } = IMAGE_SLOTS[slot];
  return { [keyColumn]: key, [blurColumn]: blur };
}
