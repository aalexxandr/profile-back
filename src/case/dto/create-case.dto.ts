import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
import { AchievementDto } from './achievement.dto';
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
    example: 'The Spectre Explorer',
    description: 'Display name of the project',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

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
    example: 'FinTech / Web App',
    description: 'Kind of project, shown as a label',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

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
    example:
      'A large multi-feature service for browsing blockchain operations.',
    description: 'One or two sentences for the list page',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shortDescription!: string;

  @ApiProperty({
    example: 'A blockchain browser for exploring and analysing Ethereum data.',
    description: 'Full description for the detail page',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    enum: Role,
    example: 'FRONTEND',
    description: "The author's role on the project",
  })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({
    type: () => [AchievementDto],
    description: 'Results of the work; may be empty, at most 10',
    maxItems: 10,
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AchievementDto)
  achievements!: AchievementDto[];

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
    description: 'Whether the case is visible in the public list and detail',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
