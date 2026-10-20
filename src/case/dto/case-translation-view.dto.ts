import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { AchievementDto } from './achievement.dto';

/** The text of a case in one language, in the full view. */
export class CaseTranslationViewDto {
  @Expose()
  @ApiProperty({
    example: 'The Spectre Explorer',
    description: 'Display name of the project',
  })
  name!: string;

  @Expose()
  @ApiProperty({
    example: 'FinTech / Web App',
    description: 'Kind of project, shown as a label',
  })
  category!: string;

  @Expose()
  @ApiProperty({
    example:
      'A large multi-feature service for browsing blockchain operations.',
    description: 'One or two sentences for the list page',
  })
  shortDescription!: string;

  @Expose()
  @ApiProperty({
    example: 'A blockchain browser for exploring and analysing Ethereum data.',
    description: 'Full description for the detail page',
  })
  description!: string;

  @Expose()
  @Type(() => AchievementDto)
  @ApiProperty({
    type: [AchievementDto],
    description: 'Results of the work, each with a highlighted metric',
  })
  achievements!: AchievementDto[];
}
