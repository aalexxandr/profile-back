import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { CaseDetailDto } from './case-detail.dto';
import { CaseFullTranslationsDto } from './case-full-translations.dto';

/**
 * A case in the full view returned by a write: the language-independent
 * fields of the detail view, the draft/order state and the text in every
 * language instead of one served language.
 */
export class CaseFullDto extends OmitType(CaseDetailDto, [
  'locale',
  'name',
  'category',
  'shortDescription',
  'description',
  'achievements',
] as const) {
  @Expose()
  @ApiProperty({
    example: 2,
    description: 'Position in the list: lower comes first, ties by newest',
  })
  sortOrder!: number;

  @Expose()
  @ApiProperty({
    example: true,
    description:
      'Whether the case is visible in the public list and detail; possible only with both `ru` and `en` text',
  })
  published!: boolean;

  @Expose()
  @Type(() => CaseFullTranslationsDto)
  @ApiProperty({
    type: () => CaseFullTranslationsDto,
    description: 'The text of the case in every language',
  })
  translations!: CaseFullTranslationsDto;
}
