import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, ValidateNested } from 'class-validator';

import { CaseTranslationDto } from './case-translation.dto';

/** Translations of a new case: Russian is always required, English may follow later. */
export class CreateCaseTranslationsDto {
  @ApiProperty({
    type: () => CaseTranslationDto,
    description:
      'Russian text, the default language; always required, because it is served when no other language is requested',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => CaseTranslationDto)
  ru!: CaseTranslationDto;

  @ApiPropertyOptional({
    type: () => CaseTranslationDto,
    description:
      'English text; required when the case is created with `published: true`, and when sent it must be complete',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseTranslationDto)
  en?: CaseTranslationDto;
}
