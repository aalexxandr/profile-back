import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { CreateCaseDto } from './create-case.dto';
import { UpdateCaseTranslationsDto } from './update-case-translations.dto';

// slug is the identity of a case and cannot change; with
// `forbidNonWhitelisted` a slug in the body is rejected. `translations` is
// replaced by its partial form: languages and fields not sent stay unchanged.
export class UpdateCaseDto extends PartialType(
  OmitType(CreateCaseDto, ['slug', 'translations'] as const),
) {
  @ApiPropertyOptional({
    type: () => UpdateCaseTranslationsDto,
    description:
      'Text to change per language, merged into the stored translations',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCaseTranslationsDto)
  translations?: UpdateCaseTranslationsDto;
}
