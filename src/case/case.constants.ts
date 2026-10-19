import { CaseDetailDto } from './dto/case-detail.dto';
import { CaseListItemDto } from './dto/case-list-item.dto';

// Only `@Expose()`d fields of the DTO are sent; the service returns DB rows.
export const LIST_ITEM = {
  type: CaseListItemDto,
  strategy: 'excludeAll',
} as const;
export const DETAIL = { type: CaseDetailDto, strategy: 'excludeAll' } as const;

export const SLUG_PARAM = {
  name: 'slug',
  description: 'Unique identifier of the case (lowercase kebab-case)',
  example: 'spectre',
} as const;

/** Larger uploads are refused with 413 before they are processed. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
