import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { Role } from '../../prisma/enums';
import { AchievementDto } from './achievement.dto';
import { CaseListItemDto } from './case-list-item.dto';

/** Extended form of a case, shown on its detail page. */
export class CaseDetailDto extends CaseListItemDto {
  @Expose()
  @ApiProperty({
    example: 'A blockchain browser for exploring and analysing Ethereum data.',
    description: 'Full description for the detail page',
  })
  description!: string;

  @Expose()
  @ApiProperty({
    enum: Role,
    example: 'FRONTEND',
    description: "The author's role on the project",
  })
  role!: Role;

  @Expose()
  @ApiProperty({
    example: 'https://thespectre.io',
    description: 'Link to the live project',
  })
  projectLink!: string;

  @Expose()
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Acme',
    description: 'Company the project was done for; null for personal projects',
  })
  company!: string | null;

  @Expose()
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 5,
    description: 'Team size; null when unknown',
  })
  teamSize!: number | null;

  @Expose()
  @ApiProperty({
    example: '2024-01-01',
    description: 'Start of the work, a date in the format YYYY-MM-DD',
  })
  startedAt!: string;

  @Expose()
  @ApiProperty({
    type: String,
    nullable: true,
    example: '2024-06-01',
    description: 'End of the work, YYYY-MM-DD; null while the work is ongoing',
  })
  endedAt!: string | null;

  @Expose()
  @Type(() => AchievementDto)
  @ApiProperty({
    type: [AchievementDto],
    description: 'Results of the work, each with a highlighted metric',
  })
  achievements!: AchievementDto[];
}
