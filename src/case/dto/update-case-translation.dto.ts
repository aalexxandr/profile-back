import { PartialType } from '@nestjs/swagger';

import { CaseTranslationDto } from './case-translation.dto';

/** Some fields of one language; fields that are not sent stay unchanged. */
export class UpdateCaseTranslationDto extends PartialType(CaseTranslationDto) {}
