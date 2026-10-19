import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import {
  ALLOWED_FORMATS,
  BLUR_PREFIX,
  BLUR_QUALITY,
  BLUR_SIGMA,
  BLUR_WIDTH,
  MAX_INPUT_PIXELS,
  MAX_WIDTH,
  WEBP_QUALITY,
} from './image.constants';
import type { ProcessedImage } from './image.types';

@Injectable()
export class ImageProcessingService {
  async process(input: Buffer): Promise<ProcessedImage> {
    // `failOn: 'warning'` makes a truncated file an error instead of a half image.
    const source = () =>
      sharp(input, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });

    try {
      const { format } = await source().metadata();
      if (!format || !ALLOWED_FORMATS.has(format)) {
        throw new BadRequestException(
          'Only JPEG, PNG and WebP images are accepted',
        );
      }

      // sharp drops EXIF/GPS unless asked to keep it; WebP keeps PNG alpha.
      const image = await source()
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      const blurBytes = await source()
        .rotate()
        .resize({ width: BLUR_WIDTH, withoutEnlargement: true })
        .blur(BLUR_SIGMA)
        .webp({ quality: BLUR_QUALITY })
        .toBuffer();

      return { image, blur: BLUR_PREFIX + blurBytes.toString('base64') };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('The file is not a valid image');
    }
  }
}
