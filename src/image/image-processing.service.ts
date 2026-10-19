import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  /** Optimized picture, a genuine WebP. */
  image: Buffer;
  /** Blurred placeholder as a `data:image/webp;base64,...` URI. */
  blur: string;
}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;
const BLUR_WIDTH = 20;
const BLUR_SIGMA = 1;
const BLUR_QUALITY = 40;
const BLUR_PREFIX = 'data:image/webp;base64,';
/** Guards against a small file that decodes into a huge bitmap. */
const MAX_INPUT_PIXELS = 50_000_000;

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
