import { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { InMemoryStorage } from './helpers/in-memory-storage';
import { uniqueId } from './helpers/unique-id';

type Body = Record<string, unknown>;

const STORAGE_URL = 'https://storage.test';

const solidJpeg = (width: number, height: number, background = '#3366cc') =>
  sharp({ create: { width, height, channels: 3, background } })
    .jpeg()
    .toBuffer();

/** A picture with pixel noise, so that its file is big enough to be cut in half. */
const noisyJpeg = () => {
  const data = Buffer.alloc(200 * 150 * 3);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 251;
  return sharp(data, { raw: { width: 200, height: 150, channels: 3 } })
    .jpeg()
    .toBuffer();
};

describe('Case image (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const storage = new InMemoryStorage(STORAGE_URL);
  const tag = uniqueId('img', 14);
  const created: string[] = [];

  const seed = async (suffix: string, published = true) => {
    const slug = `${tag}-${suffix}`;
    await prisma.cases.create({
      slug,
      name: `Case ${suffix}`,
      projectLink: 'https://example.com',
      category: 'Web App',
      stack: ['React'],
      shortDescription: `Short ${suffix}`,
      description: `Long ${suffix}`,
      role: 'FRONTEND',
      achievements: [{ title: 't', description: 'd', metric: 'm' }],
      company: null,
      teamSize: null,
      startedAt: '2024-01-01',
      endedAt: null,
      sortOrder: 0,
      published,
    });
    created.push(slug);
    return slug;
  };

  const upload = (slug: string, file: Buffer, filename = 'photo.jpg') =>
    request(server)
      .put(`/cases/${slug}/image`)
      .attach('file', file, { filename, contentType: 'image/jpeg' });

  const keyOf = (body: Body) =>
    (body.image as string).slice(`${STORAGE_URL}/`.length);

  beforeAll(async () => {
    app = await createTestApp({ imports: [AppModule] }, storage);
    server = app.getHttpServer() as typeof server;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const slug of created) {
      await prisma.cases.whereUnique({ slug }).delete();
    }
    await app.close();
  });

  describe('PUT /cases/:slug/image', () => {
    it('stores an optimized WebP and returns the URL and the placeholder', async () => {
      const slug = await seed('ok');

      const res = await upload(slug, await solidJpeg(400, 300)).expect(200);
      const body = res.body as Body;

      expect(body.image).toMatch(
        new RegExp(`^${STORAGE_URL}/cases/${slug}/[0-9a-f]{16}\\.webp$`),
      );
      expect(body.blurImage).toMatch(/^data:image\/webp;base64,/);
      expect(storage.has(keyOf(body))).toBe(true);
      expect(body).not.toHaveProperty('imageKey');
    });

    it('stores genuine WebP bytes no wider than 1920 px', async () => {
      const slug = await seed('wide');

      const res = await upload(slug, await solidJpeg(4000, 2000)).expect(200);

      const stored = storage.get(keyOf(res.body as Body));
      expect(stored?.contentType).toBe('image/webp');
      expect(stored?.body.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(stored?.body.subarray(8, 12).toString('ascii')).toBe('WEBP');
      const meta = await sharp(stored?.body).metadata();
      expect([meta.width, meta.height]).toEqual([1920, 960]);
    });

    it('accepts a picture for an unpublished case', async () => {
      const slug = await seed('draft', false);

      await upload(slug, await solidJpeg(100, 100)).expect(200);
    });

    it('shows the picture in the public detail and list', async () => {
      const slug = await seed('public');
      const put = await upload(slug, await solidJpeg(100, 100)).expect(200);
      const image = (put.body as Body).image;

      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      const list = await request(server).get('/cases').expect(200);

      expect((detail.body as Body).image).toBe(image);
      const item = (list.body as Array<Body & { slug: string }>).find(
        (i) => i.slug === slug,
      );
      expect(item?.image).toBe(image);
      expect(item?.blurImage).toMatch(/^data:image\/webp;base64,/);
    });

    it('responds 404 for an unknown case and stores nothing', async () => {
      const before = storage.keys().length;

      await upload(`${tag}-missing`, await solidJpeg(50, 50)).expect(404);

      expect(storage.keys()).toHaveLength(before);
    });

    it('responds 400 when the file field is missing', async () => {
      const slug = await seed('nofile');

      await request(server)
        .put(`/cases/${slug}/image`)
        .field('note', 'no file here')
        .expect(400);
    });

    it('responds 400 when the file is sent under another field name', async () => {
      const slug = await seed('othername');

      await request(server)
        .put(`/cases/${slug}/image`)
        .attach('picture', await solidJpeg(50, 50), 'photo.jpg')
        .expect(400);
    });

    it('rejects a text file pretending to be a JPEG', async () => {
      const slug = await seed('text');

      await upload(slug, Buffer.from('definitely not a picture')).expect(400);
    });

    it('rejects a GIF', async () => {
      const slug = await seed('gif');
      const gif = await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#ff0000' },
      })
        .gif()
        .toBuffer();

      await upload(slug, gif, 'anim.gif').expect(400);
    });

    it('rejects a truncated JPEG', async () => {
      const slug = await seed('cut');
      const whole = await noisyJpeg();

      await upload(slug, whole.subarray(0, whole.length / 2)).expect(400);
    });

    it('rejects a file over 10 MB with 413', async () => {
      const slug = await seed('big');

      await upload(slug, Buffer.alloc(11 * 1024 * 1024)).expect(413);
    });

    it('keeps the previous picture when an upload is rejected', async () => {
      const slug = await seed('keep');
      const first = await upload(slug, await solidJpeg(100, 100)).expect(200);
      const keysBefore = storage.keys().sort();

      await upload(slug, Buffer.from('broken')).expect(400);

      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      expect((detail.body as Body).image).toBe((first.body as Body).image);
      expect(storage.keys().sort()).toEqual(keysBefore);
    });

    it('gives the same URL when the same file is uploaded twice', async () => {
      const slug = await seed('twice');
      const file = await solidJpeg(120, 80);

      const first = await upload(slug, file).expect(200);
      const second = await upload(slug, file).expect(200);

      expect((second.body as Body).image).toBe((first.body as Body).image);
      expect(storage.has(keyOf(second.body as Body))).toBe(true);
    });

    it('replaces the picture and removes the old object', async () => {
      const slug = await seed('replace');
      const first = await upload(slug, await solidJpeg(100, 100)).expect(200);

      const second = await upload(
        slug,
        await solidJpeg(100, 100, '#cc3333'),
      ).expect(200);

      const oldKey = keyOf(first.body as Body);
      const newKey = keyOf(second.body as Body);
      expect(newKey).not.toBe(oldKey);
      expect(storage.has(newKey)).toBe(true);
      expect(storage.has(oldKey)).toBe(false);
    });
  });

  describe('DELETE /cases/:slug/image', () => {
    it('clears the picture and removes the object', async () => {
      const slug = await seed('del');
      const put = await upload(slug, await solidJpeg(100, 100)).expect(200);

      await request(server).delete(`/cases/${slug}/image`).expect(204);

      expect(storage.has(keyOf(put.body as Body))).toBe(false);
      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      expect(detail.body).toMatchObject({ image: null, blurImage: null });
    });

    it('answers 204 again for a case without a picture', async () => {
      const slug = await seed('del-twice');

      await request(server).delete(`/cases/${slug}/image`).expect(204);
      await request(server).delete(`/cases/${slug}/image`).expect(204);
    });

    it('responds 404 for an unknown case', async () => {
      await request(server).delete(`/cases/${tag}-missing/image`).expect(404);
    });
  });

  describe('DELETE /cases/:slug', () => {
    it('removes the stored picture together with the case', async () => {
      const slug = await seed('rm-case');
      const put = await upload(slug, await solidJpeg(100, 100)).expect(200);
      const key = keyOf(put.body as Body);
      expect(storage.has(key)).toBe(true);

      await request(server).delete(`/cases/${slug}`).expect(204);

      expect(storage.has(key)).toBe(false);
    });
  });

  describe('JSON case body', () => {
    it.each(['image', 'blurImage', 'imageKey'])(
      'PATCH rejects %s as an unknown field',
      async (field) => {
        const slug = await seed(`patch-${field.toLowerCase()}`);

        await request(server)
          .patch(`/cases/${slug}`)
          .send({ [field]: 'data:image/webp;base64,AAAA' })
          .expect(400);
      },
    );

    it('POST rejects the picture fields as unknown', async () => {
      await request(server)
        .post('/cases')
        .send({
          slug: `${tag}-post`,
          name: 'x',
          projectLink: 'https://example.com',
          category: 'c',
          stack: ['React'],
          shortDescription: 's',
          description: 'd',
          role: 'FRONTEND',
          achievements: [{ title: 't', description: 'd', metric: 'm' }],
          startedAt: '2024-01-01',
          blurImage: 'data:image/webp;base64,AAAA',
        })
        .expect(400);
    });
  });
});
