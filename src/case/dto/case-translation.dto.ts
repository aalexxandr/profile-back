import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { AchievementDto } from './achievement.dto';

/** The text of a case in one language; every field is required. */
export class CaseTranslationDto {
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
    example: 'FinTech / Web App',
    description: 'Kind of project, shown as a label',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

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
    type: () => [AchievementDto],
    description: 'Results of the work; may be empty, at most 10',
    maxItems: 10,
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AchievementDto)
  achievements!: AchievementDto[];
}
