import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Compact form of a case, shown in the general list. Only `@Expose()`d fields
 * reach the client (`strategy: 'excludeAll'` on the route).
 */
export class CaseListItemDto {
  @Expose()
  @ApiProperty({
    example: 'spectre',
    description: 'Unique identifier of the case, used in its URL',
  })
  slug!: string;

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
    type: [String],
    example: ['React', 'TypeScript'],
    description: 'Technologies used',
  })
  stack!: string[];

  @Expose()
  @ApiProperty({
    example:
      'A large multi-feature service for browsing blockchain operations.',
    description: 'One or two sentences for the list page',
  })
  shortDescription!: string;

  @Expose()
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://storage.example.com/cases/spectre/3f9a1c2b7d4e5f60.webp',
    description:
      'Absolute public URL of the case picture (WebP, at most 1920 px wide); null while the case has no picture',
  })
  image!: string | null;

  @Expose()
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4ID4AAADwAQCdASoU...',
    description:
      'Tiny blurred preview of the picture (about 20 px wide) as a data: URI, generated on upload. Show it instantly as a placeholder while `image` loads; null while the case has no picture',
  })
  blurImage!: string | null;
}
