import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Used for request validation and, with `@Expose()`, in the detail response.
export class AchievementDto {
  @Expose()
  @ApiProperty({
    example: 'Less manual work on booking requests',
    description: 'Short headline of the result',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @Expose()
  @ApiProperty({
    example:
      'Part of the booking process was automated, managers no longer collect data from clients by hand.',
    description: 'What was done and why it mattered',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @Expose()
  @ApiProperty({
    example: '-30% manual work',
    description: 'The measurable result, shown as a highlighted figure',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  metric!: string;
}
