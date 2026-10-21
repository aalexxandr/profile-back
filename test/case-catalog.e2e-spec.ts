import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

type Body = Record<string, unknown>;

// the fake storage that `createTestApp` plugs in builds URLs on this base
const STORAGE_URL = 'https://storage.test';
const PIC_KEY = 'cases/example/ab12cd34ef56ab78.webp';
const BG_KEY = 'cases/example/background/cd34ef56ab78ab12.webp';

describe('Case catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const tag = uniqueId('cat', 16);
  const created: string[] = [];

  // a case with the translations asked for (both languages by default)
  const seed = async (
    suffix: string,
    overrides: Body = {},
    locales: Array<'ru' | 'en'> = ['ru', 'en'],
  ) => {
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
      published: true,
      ...overrides,
    });
    created.push(slug);
    for (const locale of locales) {
      const ru = locale === 'ru';
      await prisma.caseTranslations.create({
        caseSlug: slug,
        locale,
        name: ru ? `Кейс ${suffix}` : `Case ${suffix}`,
        category: ru ? 'Веб-приложение' : 'Web App',
        shortDescription: ru ? `Кратко ${suffix}` : `Short ${suffix}`,
        description: ru ? `Подробно ${suffix}` : `Long ${suffix}`,
        achievements: [
          ru
            ? { title: 'т', description: 'о', metric: 'м' }
            : { title: 't', description: 'd', metric: 'm' },
        ],
      });
    }
    return slug;
  };

  // the list is shared with other data in the DB: look only at our own cases
  const listOurs = async () => {
    const res = await request(server).get('/cases').expect(200);
    return (res.body as Array<Body & { slug: string }>).filter((item) =>
      item.slug.startsWith(tag),
    );
  };

  beforeAll(async () => {
    app = await createTestApp({ imports: [AppModule] });
    server = app.getHttpServer() as typeof server;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const slug of created) {
      await prisma.cases.whereUnique({ slug }).delete();
    }
    await app.close();
  });

  describe('GET /cases', () => {
    it('lists only published cases', async () => {
      const published = await seed('pub');
      const draft = await seed('draft', { published: false });

      const slugs = (await listOurs()).map((item) => item.slug);

      expect(slugs).toContain(published);
      expect(slugs).not.toContain(draft);
    });

    it('exposes only the compact list fields', async () => {
      await seed('keys');

      const items = await listOurs();

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual([
          'blurImage',
          'category',
          'image',
          'locale',
          'name',
          'projectLink',
          'shortDescription',
          'slug',
          'stack',
        ]);
      }
    });

    it('returns null picture fields for a case without a picture', async () => {
      const slug = await seed('nopic');

      const item = (await listOurs()).find((i) => i.slug === slug);

      expect(item).toMatchObject({ image: null, blurImage: null });
    });

    it('returns the absolute picture URL and the placeholder, never the key', async () => {
      const slug = await seed('pic', {
        imageKey: PIC_KEY,
        blurImage: 'data:image/webp;base64,AAAA',
      });

      const item = (await listOurs()).find((i) => i.slug === slug);

      expect(item).toMatchObject({
        image: `${STORAGE_URL}/${PIC_KEY}`,
        blurImage: 'data:image/webp;base64,AAAA',
      });
      expect(item).not.toHaveProperty('imageKey');
    });

    it('does not put the background into the list', async () => {
      const slug = await seed('list-bg', {
        backgroundImageKey: BG_KEY,
        backgroundBlurImage: 'data:image/webp;base64,BBBB',
      });

      const item = (await listOurs()).find((i) => i.slug === slug);

      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('backgroundImage');
      expect(item).not.toHaveProperty('backgroundBlurImage');
      expect(item).not.toHaveProperty('backgroundImageKey');
    });

    it('puts a lower sortOrder first', async () => {
      const second = await seed('ord-b', { sortOrder: 2 });
      const first = await seed('ord-a', { sortOrder: 1 });

      const slugs = (await listOurs()).map((item) => item.slug);

      expect(slugs.indexOf(first)).toBeLessThan(slugs.indexOf(second));
    });

    it('breaks a sortOrder tie with the newest case first', async () => {
      const old = await seed('tie-old', {
        sortOrder: 7,
        createdAt: new Date('2020-01-01T00:00:00Z'),
      });
      const recent = await seed('tie-new', {
        sortOrder: 7,
        createdAt: new Date('2021-01-01T00:00:00Z'),
      });

      const slugs = (await listOurs()).map((item) => item.slug);

      expect(slugs.indexOf(recent)).toBeLessThan(slugs.indexOf(old));
    });
  });

  describe('language', () => {
    const idOf = (res: { body: unknown }) => res.body as Body;

    it('serves Russian and says so when no lang is given', async () => {
      const slug = await seed('lang-default');

      const res = await request(server).get(`/cases/${slug}`).expect(200);

      expect(idOf(res)).toMatchObject({
        locale: 'ru',
        name: 'Кейс lang-default',
        category: 'Веб-приложение',
        shortDescription: 'Кратко lang-default',
        description: 'Подробно lang-default',
      });
    });

    it('serves English for lang=en on the detail', async () => {
      const slug = await seed('lang-en');

      const res = await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'en' })
        .expect(200);

      expect(idOf(res)).toMatchObject({
        locale: 'en',
        name: 'Case lang-en',
        category: 'Web App',
        shortDescription: 'Short lang-en',
        description: 'Long lang-en',
        achievements: [{ title: 't', description: 'd', metric: 'm' }],
      });
    });

    it('serves Russian for lang=ru', async () => {
      const slug = await seed('lang-ru');

      const res = await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'ru' })
        .expect(200);

      expect(idOf(res)).toMatchObject({ locale: 'ru', name: 'Кейс lang-ru' });
    });

    it('localizes every item of the list', async () => {
      const slug = await seed('list-en');

      const res = await request(server)
        .get('/cases')
        .query({ lang: 'en' })
        .expect(200);
      const ours = (res.body as Array<Body & { slug: string }>).filter((item) =>
        item.slug.startsWith(tag),
      );

      expect(ours.length).toBeGreaterThan(0);
      for (const item of ours) expect(item.locale).toBe('en');
      expect(ours.find((item) => item.slug === slug)).toMatchObject({
        name: 'Case list-en',
        category: 'Web App',
        shortDescription: 'Short list-en',
      });
    });

    it('falls back to Russian for an unsupported lang, without failing', async () => {
      const slug = await seed('lang-de');

      const detail = await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'de' })
        .expect(200);
      const list = await request(server)
        .get('/cases')
        .query({ lang: 'de' })
        .expect(200);

      expect(idOf(detail)).toMatchObject({
        locale: 'ru',
        name: 'Кейс lang-de',
      });
      const item = (list.body as Array<Body & { slug: string }>).find(
        (i) => i.slug === slug,
      );
      expect(item).toMatchObject({ locale: 'ru', name: 'Кейс lang-de' });
    });

    it('ignores the Accept-Language header', async () => {
      const slug = await seed('lang-header');

      const res = await request(server)
        .get(`/cases/${slug}`)
        .set('Accept-Language', 'en')
        .expect(200);

      expect(idOf(res)).toMatchObject({
        locale: 'ru',
        name: 'Кейс lang-header',
      });
    });

    it('does not change the language-independent fields', async () => {
      const slug = await seed('lang-shared', {
        company: 'Acme',
        teamSize: 4,
        endedAt: '2024-06-01',
      });

      const ru = await request(server).get(`/cases/${slug}`).expect(200);
      const en = await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'en' })
        .expect(200);

      for (const key of [
        'slug',
        'stack',
        'role',
        'projectLink',
        'company',
        'teamSize',
        'startedAt',
        'endedAt',
        'image',
        'blurImage',
      ]) {
        expect([key, (en.body as Body)[key]]).toEqual([
          key,
          (ru.body as Body)[key],
        ]);
      }
    });

    it('serves Russian, and says so, when a published case lacks the requested English text', async () => {
      const slug = await seed('lang-missing', {}, ['ru']);

      const res = await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'en' })
        .expect(200);

      expect(idOf(res)).toMatchObject({
        locale: 'ru',
        name: 'Кейс lang-missing',
      });
    });

    it('hides an unpublished case in every language', async () => {
      const slug = await seed('lang-draft', { published: false });

      await request(server).get(`/cases/${slug}`).expect(404);
      await request(server)
        .get(`/cases/${slug}`)
        .query({ lang: 'en' })
        .expect(404);
    });
  });

  describe('Swagger', () => {
    it('documents the list item and the detail schemas', async () => {
      const res = await request(server).get('/docs-json').expect(200);
      const schemas = (res.body as { components: { schemas: Body } }).components
        .schemas;

      expect(Object.keys(schemas)).toEqual(
        expect.arrayContaining(['CaseListItemDto', 'CaseDetailDto']),
      );
    });
  });

  describe('GET /cases/:slug', () => {
    it('returns the detail view of a published case', async () => {
      const slug = await seed('detail', {
        company: 'Acme',
        teamSize: 5,
        endedAt: '2024-06-01',
      });

      const res = await request(server).get(`/cases/${slug}`).expect(200);
      const body = res.body as Body;

      expect(Object.keys(body).sort()).toEqual([
        'achievements',
        'backgroundBlurImage',
        'backgroundImage',
        'blurImage',
        'category',
        'company',
        'description',
        'endedAt',
        'image',
        'locale',
        'name',
        'projectLink',
        'role',
        'shortDescription',
        'slug',
        'stack',
        'startedAt',
        'teamSize',
      ]);
      expect(body).toMatchObject({
        slug,
        company: 'Acme',
        teamSize: 5,
        role: 'FRONTEND',
        startedAt: '2024-01-01',
        endedAt: '2024-06-01',
        achievements: [{ title: 'т', description: 'о', metric: 'м' }],
      });
    });

    it('returns null, not nothing, for absent optional fields', async () => {
      const slug = await seed('nulls');

      const res = await request(server).get(`/cases/${slug}`).expect(200);

      expect(res.body).toMatchObject({
        company: null,
        teamSize: null,
        endedAt: null,
        image: null,
        blurImage: null,
        backgroundImage: null,
        backgroundBlurImage: null,
      });
    });

    it('returns the absolute background URL and its placeholder, never the key', async () => {
      const slug = await seed('detail-bg', {
        backgroundImageKey: BG_KEY,
        backgroundBlurImage: 'data:image/webp;base64,BBBB',
      });

      const res = await request(server).get(`/cases/${slug}`).expect(200);

      expect(res.body).toMatchObject({
        backgroundImage: `${STORAGE_URL}/${BG_KEY}`,
        backgroundBlurImage: 'data:image/webp;base64,BBBB',
      });
      expect(res.body).not.toHaveProperty('backgroundImageKey');
    });

    it('returns the absolute picture URL and the placeholder of a case with a picture', async () => {
      const slug = await seed('detail-pic', {
        imageKey: PIC_KEY,
        blurImage: 'data:image/webp;base64,AAAA',
      });

      const res = await request(server).get(`/cases/${slug}`).expect(200);

      expect(res.body).toMatchObject({
        image: `${STORAGE_URL}/${PIC_KEY}`,
        blurImage: 'data:image/webp;base64,AAAA',
      });
      expect(res.body).not.toHaveProperty('imageKey');
    });

    it('responds 404 for an unknown slug', async () => {
      await request(server).get(`/cases/${tag}-missing`).expect(404);
    });

    it('responds 404 for an unpublished case, same as for an unknown one', async () => {
      const draft = await seed('hidden', { published: false });

      const hidden = await request(server).get(`/cases/${draft}`).expect(404);
      const unknown = await request(server)
        .get(`/cases/${tag}-missing`)
        .expect(404);

      const pick = (body: Body) => ({
        status: body.status,
        message: body.message,
      });
      expect(pick(hidden.body as Body)).toEqual(pick(unknown.body as Body));
    });
  });
});
