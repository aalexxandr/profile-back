import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { UpdateCaseTranslationDto } from './update-case-translation.dto';

/** Languages to change; a language that is not sent is not touched. */
export class UpdateCaseTranslationsDto {
  @ApiPropertyOptional({
    type: () => UpdateCaseTranslationDto,
    description:
      'Russian text to change: only the fields sent are replaced. `achievements`, when sent, replaces the whole list',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCaseTranslationDto)
  ru?: UpdateCaseTranslationDto;

  @ApiPropertyOptional({
    type: () => UpdateCaseTranslationDto,
    description:
      'English text to change. If the case has no English text yet, the object must be complete and creates it',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCaseTranslationDto)
  en?: UpdateCaseTranslationDto;
}
