import type { CaseImageSlot, CaseRow, Locale } from './case.types';
import { CaseDetailDto } from './dto/case-detail.dto';
import { CaseFullDto } from './dto/case-full.dto';
import { CaseListItemDto } from './dto/case-list-item.dto';

// Only `@Expose()`d fields of the DTO are sent; the service returns DB rows.
export const LIST_ITEM = {
  type: CaseListItemDto,
  strategy: 'excludeAll',
} as const;
export const DETAIL = { type: CaseDetailDto, strategy: 'excludeAll' } as const;
export const FULL = { type: CaseFullDto, strategy: 'excludeAll' } as const;

export const SLUG_PARAM = {
  name: 'slug',
  description: 'Unique identifier of the case (lowercase kebab-case)',
  example: 'spectre',
} as const;

/** Served when `lang` is missing or unsupported. */
export const DEFAULT_LOCALE = 'ru' as const;

/** Every language a published case must be translated into. */
export const SUPPORTED_LOCALES = [
  'ru',
  'en',
] as const satisfies readonly Locale[];

/** The `400` message when a case would be published without every language. */
export const PUBLISH_NEEDS_ALL_LANGUAGES =
  'A case can be published only with both a ru and an en translation';

export const LANG_QUERY = {
  name: 'lang',
  required: false,
  example: 'en',
  description:
    'Language of the text fields: `ru` or `en`. When missing or anything else, the response is in `ru` (the `Accept-Language` header is not used). The language actually served is returned as `locale`.',
  schema: {
    type: 'string',
    enum: [...SUPPORTED_LOCALES],
    default: DEFAULT_LOCALE,
  },
} as const;

/** Larger uploads are refused with 413 before they are processed. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Where each picture of a case lives: the row columns holding its storage key
 * and blur placeholder, and the folder (under `cases/<slug>/`) of its object.
 */
export const IMAGE_SLOTS = {
  image: { keyColumn: 'imageKey', blurColumn: 'blurImage', folder: '' },
  background: {
    keyColumn: 'backgroundImageKey',
    blurColumn: 'backgroundBlurImage',
    folder: 'background/',
  },
} as const satisfies Record<
  CaseImageSlot,
  {
    keyColumn: keyof CaseRow;
    blurColumn: keyof CaseRow;
    folder: string;
  }
>;

/** Swagger body of a picture upload: one binary field `file`. */
export const IMAGE_UPLOAD_BODY = {
  required: true,
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description:
          'The picture: JPEG, PNG or WebP (recognised by content, not by name), up to 10 MB',
      },
    },
  },
} as const;

/** Swagger body of a background upload: one binary field `file`. */
export const BACKGROUND_UPLOAD_BODY = {
  required: true,
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description:
          'The background picture: JPEG, PNG or WebP (recognised by content, not by name), up to 10 MB',
      },
    },
  },
} as const;
