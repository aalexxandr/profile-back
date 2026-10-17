import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateCaseDto } from './create-case.dto';

// slug is the identity of a case and cannot change; with
// `forbidNonWhitelisted` a slug in the body is rejected.
export class UpdateCaseDto extends PartialType(
  OmitType(CreateCaseDto, ['slug'] as const),
) {}
