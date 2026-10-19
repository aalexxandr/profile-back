import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { ImageProcessingService } from './image-processing.service';

const RAW = { width: 64, height: 48, channels: 3 as const };

/** Pixel noise so that the encoded file is big enough to be cut in half. */
function noise(width: number, height: number) {
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 251;
  return sharp(data, { raw: { width, height, channels: 3 } });
}

const jpeg = () => noise(RAW.width, RAW.height).jpeg().toBuffer();
const png = () => noise(RAW.width, RAW.height).png().toBuffer();
const webp = () => noise(RAW.width, RAW.height).webp().toBuffer();
const gif = () => noise(RAW.width, RAW.height).gif().toBuffer();

const solid = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#3366cc' },
  });

describe('ImageProcessingService: optimized WebP', () => {
  const service = new ImageProcessingService();

  it('downscales a wide picture to 1920 px keeping the aspect ratio', async () => {
    const { image } = await service.process(
      await solid(4000, 2000).jpeg().toBuffer(),
    );

    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([1920, 960]);
  });

  it('does not enlarge a small picture', async () => {
    const { image } = await service.process(
      await solid(400, 300).png().toBuffer(),
    );

    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it('re-encodes to a genuine WebP, not the original bytes', async () => {
    const { image } = await service.process(await jpeg());

    expect(image.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(image.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect((await sharp(image).metadata()).format).toBe('webp');
  });

  it('applies the EXIF orientation to the pixels', async () => {
    const rotated = await solid(100, 50)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const { image } = await service.process(rotated);

    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([50, 100]);
    expect(meta.orientation ?? 1).toBe(1);
  });

  it('drops EXIF metadata', async () => {
    const withExif = await solid(100, 50)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'secret' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const { image } = await service.process(withExif);

    expect((await sharp(image).metadata()).exif).toBeUndefined();
  });

  it('keeps the transparency of a PNG', async () => {
    const transparent = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 4,
        background: { r: 200, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const { image } = await service.process(transparent);

    expect((await sharp(image).metadata()).hasAlpha).toBe(true);
  });
});

describe('ImageProcessingService: blur placeholder', () => {
  const service = new ImageProcessingService();
  const PREFIX = 'data:image/webp;base64,';

  it('is a small decodable WebP data URI with the aspect ratio of the source', async () => {
    const { blur } = await service.process(
      await solid(1600, 900).jpeg().toBuffer(),
    );

    expect(blur.startsWith(PREFIX)).toBe(true);
    const bytes = Buffer.from(blur.slice(PREFIX.length), 'base64');
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(32);
    const ratio = (meta.width ?? 0) / (meta.height ?? 1);
    expect(Math.abs(ratio - 1600 / 900)).toBeLessThan(0.2);
  });

  it('stays below 2000 characters even for a detailed picture', async () => {
    const detailed = await noise(1600, 900).jpeg().toBuffer();

    const { blur } = await service.process(detailed);

    expect(blur.length).toBeLessThan(2000);
  });

  it('does not enlarge a tiny source', async () => {
    const { blur } = await service.process(
      await solid(10, 10).png().toBuffer(),
    );

    const bytes = Buffer.from(blur.slice(PREFIX.length), 'base64');
    expect((await sharp(bytes).metadata()).width).toBeLessThanOrEqual(10);
  });
});

describe('ImageProcessingService: accepted input', () => {
  const service = new ImageProcessingService();

  it.each([
    ['JPEG', jpeg],
    ['PNG', png],
    ['WebP', webp],
  ])('accepts a %s', async (_name, make) => {
    const result = await service.process(await make());

    expect(result.image.length).toBeGreaterThan(0);
    expect(result.blur).toMatch(/^data:image\/webp;base64,/);
  });
});

describe('ImageProcessingService: rejected input', () => {
  const service = new ImageProcessingService();

  it('rejects a text file pretending to be an image', async () => {
    const promise = service.process(Buffer.from('this is not a picture'));

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty buffer', async () => {
    const promise = service.process(Buffer.alloc(0));

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a GIF: the format is not allowed', async () => {
    const promise = service.process(await gif());

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a truncated JPEG that cannot be decoded', async () => {
    const whole = await jpeg();
    const truncated = whole.subarray(0, Math.floor(whole.length / 2));

    await expect(service.process(truncated)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
