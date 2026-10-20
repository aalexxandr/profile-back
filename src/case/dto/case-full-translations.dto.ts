import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { CaseTranslationViewDto } from './case-translation-view.dto';

/** The text of a case in every supported language. */
export class CaseFullTranslationsDto {
  @Expose()
  @Type(() => CaseTranslationViewDto)
  @ApiProperty({
    type: () => CaseTranslationViewDto,
    nullable: true,
    description:
      'Russian text, the default language; null only for a case that has none',
  })
  ru!: CaseTranslationViewDto | null;

  @Expose()
  @Type(() => CaseTranslationViewDto)
  @ApiProperty({
    type: () => CaseTranslationViewDto,
    nullable: true,
    description:
      'English text; null while it has not been written, which keeps the case a draft',
  })
  en!: CaseTranslationViewDto | null;
}
