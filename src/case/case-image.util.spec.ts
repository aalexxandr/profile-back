import { createHash } from 'node:crypto';

import { IMAGE_SLOTS } from './case.constants';
import { pictureColumns, pictureKey } from './case-image.util';

describe('pictureKey', () => {
  const bytes = Buffer.from('optimized webp bytes');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

  it('puts the case picture directly under the case folder', () => {
    expect(pictureKey('spectre', 'image', bytes)).toBe(
      `cases/spectre/${hash}.webp`,
    );
  });

  it('puts the background in its own subfolder', () => {
    expect(pictureKey('spectre', 'background', bytes)).toBe(
      `cases/spectre/background/${hash}.webp`,
    );
  });

  it('gives the same key to the same bytes and another key to other bytes', () => {
    expect(pictureKey('spectre', 'image', bytes)).toBe(
      pictureKey('spectre', 'image', Buffer.from(bytes)),
    );
    expect(pictureKey('spectre', 'image', bytes)).not.toBe(
      pictureKey('spectre', 'image', Buffer.from('other bytes')),
    );
  });

  it('never gives a background and a picture the same key', () => {
    expect(pictureKey('spectre', 'background', bytes)).not.toBe(
      pictureKey('spectre', 'image', bytes),
    );
  });
});

describe('IMAGE_SLOTS', () => {
  it('maps the picture to imageKey and blurImage', () => {
    expect(IMAGE_SLOTS.image).toMatchObject({
      keyColumn: 'imageKey',
      blurColumn: 'blurImage',
    });
  });

  it('maps the background to its own columns', () => {
    expect(IMAGE_SLOTS.background).toMatchObject({
      keyColumn: 'backgroundImageKey',
      blurColumn: 'backgroundBlurImage',
    });
  });
});

describe('pictureColumns', () => {
  it('sets the picture columns only', () => {
    expect(pictureColumns('image', 'k', 'b')).toEqual({
      imageKey: 'k',
      blurImage: 'b',
    });
  });

  it('sets the background columns only', () => {
    expect(pictureColumns('background', 'k', 'b')).toEqual({
      backgroundImageKey: 'k',
      backgroundBlurImage: 'b',
    });
  });

  it('clears a slot with nulls', () => {
    expect(pictureColumns('background', null, null)).toEqual({
      backgroundImageKey: null,
      backgroundBlurImage: null,
    });
  });
});
