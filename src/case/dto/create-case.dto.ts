import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'] })
  @MaxLength(100)
  projectLink!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  stack!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shortDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsEnum(Role)
  role!: Role;

  @IsArray()
  @ArrayMaxSize(10)
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(500, { each: true })
  achievements!: string[];
}
