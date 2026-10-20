import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Role } from '../../prisma/enums';
import { CreateCaseTranslationsDto } from './create-case-translations.dto';
import { IsNotBefore } from './is-not-before.decorator';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// a date without time; IsISO8601 (strict) then rejects impossible dates
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCaseDto {
  @ApiProperty({
    example: 'spectre',
    description:
      'Unique identifier of the case, used in its URL. Lowercase kebab-case; cannot be changed later',
    maxLength: 50,
    pattern: KEBAB_CASE.source,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(KEBAB_CASE, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiProperty({
    example: 'https://thespectre.io',
    description: 'Link to the live project, http or https',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'] })
  @MaxLength(100)
  projectLink!: string;

  @ApiProperty({
    type: [String],
    example: ['React', 'TypeScript', 'MobX'],
    description: 'Technologies used: 1 to 10 unique non-empty names',
    minItems: 1,
    maxItems: 10,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  stack!: string[];

  @ApiProperty({
    enum: Role,
    example: 'FRONTEND',
    description: "The author's role on the project",
  })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({
    type: () => CreateCaseTranslationsDto,
    description:
      'Text of the case per language. `ru` is required; `en` is required when `published` is true',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCaseTranslationsDto)
  translations!: CreateCaseTranslationsDto;

  @ApiPropertyOptional({
    example: 'Acme',
    description: 'Company the project was done for; omit for personal projects',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Number of people in the team, at least 1; omit if unknown',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Start of the work, a date in the format YYYY-MM-DD',
    pattern: ISO_DATE.source,
  })
  @Matches(ISO_DATE, { message: 'startedAt must be a date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  startedAt!: string;

  @ApiPropertyOptional({
    example: '2024-06-01',
    description:
      'End of the work, YYYY-MM-DD, not earlier than startedAt; omit while the work is ongoing',
    pattern: ISO_DATE.source,
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'endedAt must be a date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  @IsNotBefore('startedAt')
  endedAt?: string;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Position in the list: lower comes first, ties by newest',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Whether the case is visible in the public list and detail. Possible only when the case has both `ru` and `en` (English) translations',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
