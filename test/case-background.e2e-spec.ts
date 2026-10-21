import { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminAuth } from './helpers/admin-auth';
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

describe('Case background (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const storage = new InMemoryStorage(STORAGE_URL);
  const tag = uniqueId('bg', 14);
  const created: string[] = [];

  const seed = async (suffix: string, published = true) => {
    const slug = `${tag}-${suffix}`;
    await prisma.cases.create({
      slug,
      projectLink: 'https://example.com',
      stack: ['React'],
      role: 'FRONTEND',
      company: null,
      teamSize: null,
      startedAt: '2024-01-01',
      endedAt: null,
      sortOrder: 0,
      published,
    });
    created.push(slug);
    for (const locale of ['ru', 'en'] as const) {
      await prisma.caseTranslations.create({
        caseSlug: slug,
        locale,
        name: `Case ${suffix} ${locale}`,
        category: 'Web App',
        shortDescription: `Short ${suffix}`,
        description: `Long ${suffix}`,
        achievements: [{ title: 't', description: 'd', metric: 'm' }],
      });
    }
    return slug;
  };

  const uploadBackground = (slug: string, file: Buffer, name = 'bg.jpg') =>
    request(server)
      .put(`/cases/${slug}/background`)
      .set(...adminAuth())
      .attach('file', file, { filename: name, contentType: 'image/jpeg' });

  const uploadImage = (slug: string, file: Buffer) =>
    request(server)
      .put(`/cases/${slug}/image`)
      .set(...adminAuth())
      .attach('file', file, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

  const keyOf = (url: unknown) =>
    (url as string).slice(`${STORAGE_URL}/`.length);

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

  describe('admin token', () => {
    it('refuses an upload without a token and stores nothing', async () => {
      const slug = await seed('noauth');
      const keysBefore = storage.keys().length;

      await request(server)
        .put(`/cases/${slug}/background`)
        .attach('file', await solidJpeg(100, 100), {
          filename: 'bg.jpg',
          contentType: 'image/jpeg',
        })
        .expect(401);

      expect(storage.keys()).toHaveLength(keysBefore);
      const row = await prisma.cases.first({ slug });
      expect(row?.backgroundImageKey).toBeFalsy();
    });

    it('refuses to remove a background with a wrong token and keeps it', async () => {
      const slug = await seed('wrongtoken');
      const put = await uploadBackground(
        slug,
        await solidJpeg(100, 100),
      ).expect(200);

      await request(server)
        .delete(`/cases/${slug}/background`)
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);

      expect(storage.has(keyOf((put.body as Body).backgroundImage))).toBe(true);
    });
  });

  describe('PUT /cases/:slug/background', () => {
    it('stores an optimized WebP in the background folder and returns URL and placeholder', async () => {
      const slug = await seed('ok');

      const res = await uploadBackground(
        slug,
        await solidJpeg(400, 300),
      ).expect(200);
      const body = res.body as Body;

      expect(body.backgroundImage).toMatch(
        new RegExp(
          `^${STORAGE_URL}/cases/${slug}/background/[0-9a-f]{16}\\.webp$`,
        ),
      );
      expect(body.backgroundBlurImage).toMatch(/^data:image\/webp;base64,/);
      expect(storage.has(keyOf(body.backgroundImage))).toBe(true);
      expect(body).not.toHaveProperty('backgroundImageKey');
      expect(body).toHaveProperty('translations');
    });

    it('does not change the case picture', async () => {
      const slug = await seed('independent');
      const picture = await uploadImage(slug, await solidJpeg(100, 100)).expect(
        200,
      );

      const res = await uploadBackground(
        slug,
        await solidJpeg(100, 100, '#cc3333'),
      ).expect(200);

      const body = res.body as Body;
      const pictureBody = picture.body as Body;
      expect(body.image).toBe(pictureBody.image);
      expect(body.blurImage).toBe(pictureBody.blurImage);
      expect(storage.has(keyOf(pictureBody.image))).toBe(true);
    });

    it('stores genuine WebP bytes no wider than 1920 px', async () => {
      const slug = await seed('wide');

      const res = await uploadBackground(
        slug,
        await solidJpeg(4000, 2000),
      ).expect(200);

      const stored = storage.get(keyOf((res.body as Body).backgroundImage));
      expect(stored?.contentType).toBe('image/webp');
      expect(stored?.body.subarray(8, 12).toString('ascii')).toBe('WEBP');
      const meta = await sharp(stored?.body).metadata();
      expect([meta.width, meta.height]).toEqual([1920, 960]);
    });

    it('accepts a background for an unpublished case', async () => {
      const slug = await seed('draft', false);

      await uploadBackground(slug, await solidJpeg(100, 100)).expect(200);
    });

    it('responds 404 for an unknown case and stores nothing', async () => {
      const before = storage.keys().length;

      await uploadBackground(`${tag}-missing`, await solidJpeg(50, 50)).expect(
        404,
      );

      expect(storage.keys()).toHaveLength(before);
    });

    it('responds 400 when the file field is missing', async () => {
      const slug = await seed('nofile');

      await request(server)
        .put(`/cases/${slug}/background`)
        .set(...adminAuth())
        .field('note', 'no file here')
        .expect(400);
    });

    it('rejects a text file pretending to be a JPEG', async () => {
      const slug = await seed('text');

      await uploadBackground(slug, Buffer.from('not a picture')).expect(400);
    });

    it('rejects a truncated JPEG', async () => {
      const slug = await seed('cut');
      const whole = await noisyJpeg();

      await uploadBackground(slug, whole.subarray(0, whole.length / 2)).expect(
        400,
      );
    });

    it('rejects a file over 10 MB with 413', async () => {
      const slug = await seed('big');

      await uploadBackground(slug, Buffer.alloc(11 * 1024 * 1024)).expect(413);
    });

    it('keeps the previous background when an upload is rejected', async () => {
      const slug = await seed('keep');
      const first = await uploadBackground(
        slug,
        await solidJpeg(100, 100),
      ).expect(200);
      const keysBefore = storage.keys().sort();

      await uploadBackground(slug, Buffer.from('broken')).expect(400);

      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      expect((detail.body as Body).backgroundImage).toBe(
        (first.body as Body).backgroundImage,
      );
      expect(storage.keys().sort()).toEqual(keysBefore);
    });

    it('gives the same URL when the same file is uploaded twice', async () => {
      const slug = await seed('twice');
      const file = await solidJpeg(120, 80);

      const first = await uploadBackground(slug, file).expect(200);
      const second = await uploadBackground(slug, file).expect(200);

      const url = (second.body as Body).backgroundImage;
      expect(url).toBe((first.body as Body).backgroundImage);
      expect(storage.has(keyOf(url))).toBe(true);
    });

    it('replaces the background and removes the old object', async () => {
      const slug = await seed('replace');
      const first = await uploadBackground(
        slug,
        await solidJpeg(100, 100),
      ).expect(200);

      const second = await uploadBackground(
        slug,
        await solidJpeg(100, 100, '#cc3333'),
      ).expect(200);

      const oldKey = keyOf((first.body as Body).backgroundImage);
      const newKey = keyOf((second.body as Body).backgroundImage);
      expect(newKey).not.toBe(oldKey);
      expect(storage.has(newKey)).toBe(true);
      expect(storage.has(oldKey)).toBe(false);
    });
  });

  describe('public reads', () => {
    it('shows the background in the detail but not in the list', async () => {
      const slug = await seed('public');
      const put = await uploadBackground(
        slug,
        await solidJpeg(100, 100),
      ).expect(200);
      const body = put.body as Body;

      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      const list = await request(server).get('/cases').expect(200);

      expect(detail.body).toMatchObject({
        backgroundImage: body.backgroundImage,
        backgroundBlurImage: body.backgroundBlurImage,
      });
      expect(detail.body).not.toHaveProperty('backgroundImageKey');
      const item = (list.body as Array<Body & { slug: string }>).find(
        (i) => i.slug === slug,
      );
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('backgroundImage');
      expect(item).not.toHaveProperty('backgroundBlurImage');
    });

    it('sends null background fields for a case without a background', async () => {
      const slug = await seed('nobg');

      const detail = await request(server).get(`/cases/${slug}`).expect(200);

      expect(detail.body).toMatchObject({
        backgroundImage: null,
        backgroundBlurImage: null,
      });
    });
  });

  describe('DELETE /cases/:slug/background', () => {
    it('clears the background, removes the object and keeps the picture', async () => {
      const slug = await seed('del');
      const picture = await uploadImage(slug, await solidJpeg(100, 100)).expect(
        200,
      );
      const put = await uploadBackground(
        slug,
        await solidJpeg(100, 100, '#cc3333'),
      ).expect(200);

      await request(server)
        .delete(`/cases/${slug}/background`)
        .set(...adminAuth())
        .expect(204);

      expect(storage.has(keyOf((put.body as Body).backgroundImage))).toBe(
        false,
      );
      const detail = await request(server).get(`/cases/${slug}`).expect(200);
      expect(detail.body).toMatchObject({
        backgroundImage: null,
        backgroundBlurImage: null,
        image: (picture.body as Body).image,
      });
    });

    it('answers 204 again for a case without a background', async () => {
      const slug = await seed('del-twice');

      await request(server)
        .delete(`/cases/${slug}/background`)
        .set(...adminAuth())
        .expect(204);
      await request(server)
        .delete(`/cases/${slug}/background`)
        .set(...adminAuth())
        .expect(204);
    });

    it('responds 404 for an unknown case', async () => {
      await request(server)
        .delete(`/cases/${tag}-missing/background`)
        .set(...adminAuth())
        .expect(404);
    });
  });

  describe('DELETE /cases/:slug', () => {
    it('removes the picture and the background together with the case', async () => {
      const slug = await seed('rm-case');
      const picture = await uploadImage(slug, await solidJpeg(100, 100)).expect(
        200,
      );
      const background = await uploadBackground(
        slug,
        await solidJpeg(100, 100, '#cc3333'),
      ).expect(200);
      const pictureKey = keyOf((picture.body as Body).image);
      const backgroundKey = keyOf((background.body as Body).backgroundImage);

      await request(server)
        .delete(`/cases/${slug}`)
        .set(...adminAuth())
        .expect(204);

      expect(storage.has(pictureKey)).toBe(false);
      expect(storage.has(backgroundKey)).toBe(false);
    });
  });

  describe('JSON case body', () => {
    it.each(['backgroundImage', 'backgroundBlurImage', 'backgroundImageKey'])(
      'PATCH rejects %s as an unknown field',
      async (field) => {
        const slug = await seed(`patch-${field.toLowerCase()}`);

        await request(server)
          .patch(`/cases/${slug}`)
          .set(...adminAuth())
          .send({ [field]: 'https://example.com/x.webp' })
          .expect(400);
      },
    );
  });
});
