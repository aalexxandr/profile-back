import { createHash } from 'node:crypto';

import { pictureKey } from './case-image.util';

describe('pictureKey', () => {
  const bytes = Buffer.from('optimized webp bytes');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

  it('puts the picture directly under the case folder', () => {
    expect(pictureKey('spectre', bytes)).toBe(`cases/spectre/${hash}.webp`);
  });

  it('gives the same key to the same bytes and another key to other bytes', () => {
    expect(pictureKey('spectre', bytes)).toBe(
      pictureKey('spectre', Buffer.from(bytes)),
    );
    expect(pictureKey('spectre', bytes)).not.toBe(
      pictureKey('spectre', Buffer.from('other bytes')),
    );
  });
});
