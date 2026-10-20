import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminAuth } from './helpers/admin-auth';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

type Body = Record<string, unknown>;
type Lang = 'ru' | 'en';

describe('Case management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const tag = uniqueId('mgmt', 16);
  const created: string[] = [];

  const slugOf = (suffix: string) => `${tag}-${suffix}`;

  // the five text fields of one language
  const text = (suffix: string, lang: Lang, overrides: Body = {}): Body => ({
    name: lang === 'ru' ? `Кейс ${suffix}` : `Case ${suffix}`,
    category: lang === 'ru' ? 'Веб-приложение' : 'Web App',
    shortDescription: lang === 'ru' ? 'Кратко' : 'Short',
    description: lang === 'ru' ? 'Подробно' : 'Long',
    achievements: [{ title: 't', description: 'd', metric: 'm' }],
    ...overrides,
  });

  const bothLanguages = (suffix: string) => ({
    ru: text(suffix, 'ru'),
    en: text(suffix, 'en'),
  });

  const validCase = (suffix: string, overrides: Body = {}): Body => ({
    slug: slugOf(suffix),
    projectLink: 'https://example.com',
    stack: ['React', 'TypeScript'],
    role: 'FRONTEND',
    startedAt: '2024-01-01',
    translations: { ru: text(suffix, 'ru') },
    ...overrides,
  });

  const post = (body: Body) => {
    if (typeof body.slug === 'string') created.push(body.slug);
    return request(server)
      .post('/cases')
      .set(...adminAuth())
      .send(body);
  };

  const patch = (slug: unknown, body: Body) =>
    request(server)
      .patch(`/cases/${String(slug)}`)
      .set(...adminAuth())
      .send(body);

  const listedSlugs = async () => {
    const res = await request(server).get('/cases').expect(200);
    return (res.body as Array<{ slug: string }>).map((item) => item.slug);
  };

  const storedTranslations = (slug: unknown) =>
    prisma.caseTranslations.where({ caseSlug: String(slug) }).all();

  beforeAll(async () => {
    app = await createTestApp({ imports: [AppModule] });
    server = app.getHttpServer() as typeof server;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // the translations go with their case (cascade)
    for (const slug of created) {
      await prisma.cases.whereUnique({ slug }).delete();
    }
    await app.close();
  });

  describe('admin token', () => {
    it('refuses POST without a token and creates nothing', async () => {
      const body = validCase('noauth');

      await request(server).post('/cases').send(body).expect(401);

      expect(await prisma.cases.first({ slug: String(body.slug) })).toBeFalsy();
    });

    it('refuses PATCH without a token and keeps the text', async () => {
      const body = validCase('noauth-patch');
      await post(body).expect(201);

      await request(server)
        .patch(`/cases/${String(body.slug)}`)
        .send({ translations: { ru: { name: 'Hacked' } } })
        .expect(401);

      const [row] = await storedTranslations(body.slug);
      expect(row?.name).toBe((body.translations as Record<Lang, Body>).ru.name);
    });

    it('refuses DELETE with a wrong token and keeps the case', async () => {
      const body = validCase('wrongtoken', {
        published: true,
        translations: bothLanguages('wrongtoken'),
      });
      await post(body).expect(201);

      await request(server)
        .delete(`/cases/${String(body.slug)}`)
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);

      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(200);
    });

    it('answers 401, not 404, for an unknown case without a token', async () => {
      await request(server)
        .patch(`/cases/${slugOf('missing')}`)
        .send({ translations: { ru: { name: 'x' } } })
        .expect(401);
    });

    it('keeps the public reads open without a token', async () => {
      await request(server).get('/cases').expect(200);
    });
  });

  describe('POST /cases', () => {
    it('creates a hidden draft from the required fields and the Russian text only', async () => {
      const body = validCase('min');

      const res = await post(body).expect(201);

      expect(res.body).toMatchObject({
        slug: body.slug,
        company: null,
        teamSize: null,
        startedAt: '2024-01-01',
        endedAt: null,
        published: false,
        sortOrder: 0,
      });
      const translations = (res.body as { translations: Body }).translations;
      expect(translations.ru).toEqual(text('min', 'ru'));
      expect(translations.en).toBeNull();
      expect(res.body).not.toHaveProperty('name');
      expect(res.body).not.toHaveProperty('locale');
      expect(await listedSlugs()).not.toContain(body.slug);
    });

    it('stores one translation row per language it was given', async () => {
      const draft = validCase('rows-ru');
      const both = validCase('rows-both', {
        translations: bothLanguages('rows-both'),
      });
      await post(draft).expect(201);
      await post(both).expect(201);

      expect(await storedTranslations(draft.slug)).toHaveLength(1);
      expect(
        (await storedTranslations(both.slug)).map((row) => row.locale).sort(),
      ).toEqual(['en', 'ru']);
    });

    it('creates a published case with both languages and the optional fields', async () => {
      const body = validCase('full', {
        published: true,
        company: 'Acme',
        teamSize: 5,
        sortOrder: 3,
        endedAt: '2024-06-01',
        translations: bothLanguages('full'),
      });

      const res = await post(body).expect(201);

      expect(res.body).toMatchObject({
        company: 'Acme',
        teamSize: 5,
        startedAt: '2024-01-01',
        endedAt: '2024-06-01',
        published: true,
      });
      expect(await listedSlugs()).toContain(body.slug);
      const english = await request(server)
        .get(`/cases/${String(body.slug)}`)
        .query({ lang: 'en' })
        .expect(200);
      expect(english.body).toMatchObject({ locale: 'en', name: 'Case full' });
    });

    it('responds 400 and stores nothing when publishing without an English text', async () => {
      const body = validCase('pub-no-en', { published: true });

      await post(body).expect(400);

      expect(await prisma.cases.first({ slug: String(body.slug) })).toBeFalsy();
      expect(await storedTranslations(body.slug)).toHaveLength(0);
    });

    it('responds 409 when the slug is taken and leaves the stored text alone', async () => {
      const body = validCase('dup');
      await post(body).expect(201);

      await post(
        validCase('dup', {
          translations: { ru: text('dup', 'ru', { name: 'Other' }) },
        }),
      ).expect(409);

      const [row] = await storedTranslations(body.slug);
      expect(row?.name).toBe('Кейс dup');
    });

    it.each([
      ['a slug that is not kebab-case', { slug: 'My Case!' }],
      ['a non-http link', { projectLink: 'ftp://example.com' }],
      ['an unknown field', { foo: 1 }],
      ['a team size of 0', { teamSize: 0 }],
      ['duplicate stack entries', { stack: ['React', 'React'] }],
      [
        'a period that ends before it starts',
        { startedAt: '2024-05-01', endedAt: '2024-01-01' },
      ],
      ['a missing start date', { startedAt: undefined }],
      ['missing translations', { translations: undefined }],
      ['empty translations', { translations: {} }],
      [
        'only an English translation',
        { translations: { en: text('bad', 'en') } },
      ],
      [
        'an incomplete English translation',
        {
          translations: {
            ru: text('bad', 'ru'),
            en: text('bad', 'en', { description: undefined }),
          },
        },
      ],
      [
        'an unknown language',
        { translations: { ru: text('bad', 'ru'), de: text('bad', 'en') } },
      ],
      [
        'the old flat text fields',
        { name: 'Old', category: 'Old', description: 'Old' },
      ],
      [
        'a name of 101 characters',
        {
          translations: {
            ru: text('bad', 'ru', { name: 'a'.repeat(101) }),
          },
        },
      ],
      [
        'an achievement without a metric',
        {
          translations: {
            ru: text('bad', 'ru', {
              achievements: [{ title: 't', description: 'd' }],
            }),
          },
        },
      ],
      [
        '11 achievements',
        {
          translations: {
            ru: text('bad', 'ru', {
              achievements: Array.from({ length: 11 }, () => ({
                title: 't',
                description: 'd',
                metric: 'm',
              })),
            }),
          },
        },
      ],
    ])('responds 400 for %s', async (_name, overrides) => {
      const body = validCase('bad', overrides);
      // only a valid slug could ever reach the DB; nothing to clean up here
      await request(server)
        .post('/cases')
        .set(...adminAuth())
        .send(body)
        .expect(400);
    });
  });

  describe('PATCH /cases/:slug', () => {
    it('publishes a draft that has both languages', async () => {
      const body = validCase('publish', {
        translations: bothLanguages('publish'),
      });
      await post(body).expect(201);

      const res = await patch(body.slug, { published: true }).expect(200);

      expect(res.body).toMatchObject({ slug: body.slug, published: true });
      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(200);
    });

    it('responds 400 and keeps the draft when publishing without an English text', async () => {
      const body = validCase('publish-no-en');
      await post(body).expect(201);

      await patch(body.slug, { published: true }).expect(400);

      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(404);
      const row = await prisma.cases.first({ slug: String(body.slug) });
      expect(row?.published).toBe(false);
    });

    it('adds the English text and publishes in one request', async () => {
      const body = validCase('publish-add-en');
      await post(body).expect(201);

      const res = await patch(body.slug, {
        published: true,
        translations: { en: text('publish-add-en', 'en') },
      }).expect(200);

      expect(res.body).toMatchObject({ published: true });
      expect((res.body as { translations: Body }).translations.en).toEqual(
        text('publish-add-en', 'en'),
      );
      const english = await request(server)
        .get(`/cases/${String(body.slug)}`)
        .query({ lang: 'en' })
        .expect(200);
      expect(english.body).toMatchObject({
        locale: 'en',
        name: 'Case publish-add-en',
      });
    });

    it('keeps the fields that are not in the body', async () => {
      const body = validCase('keep', {
        company: 'Acme',
        teamSize: 4,
        translations: bothLanguages('keep'),
      });
      const before = (await post(body).expect(201)).body as Body;

      const res = await patch(body.slug, {
        projectLink: 'https://new.example.com',
      }).expect(200);

      expect(res.body).toEqual({
        ...before,
        projectLink: 'https://new.example.com',
      });
    });

    it('merges one field of one language and leaves the rest as stored', async () => {
      const body = validCase('merge', { translations: bothLanguages('merge') });
      const before = (await post(body).expect(201)).body as {
        translations: Record<Lang, Body>;
      };

      const res = await patch(body.slug, {
        translations: { en: { name: 'New English name' } },
      }).expect(200);

      const after = (res.body as { translations: Record<Lang, Body> })
        .translations;
      expect(after.en).toEqual({
        ...before.translations.en,
        name: 'New English name',
      });
      expect(after.ru).toEqual(before.translations.ru);
    });

    it('changes the text of a published case without unpublishing it', async () => {
      const body = validCase('merge-pub', {
        published: true,
        translations: bothLanguages('merge-pub'),
      });
      await post(body).expect(201);

      await patch(body.slug, {
        translations: { ru: { name: 'Новое имя' } },
      }).expect(200);

      const ru = await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(200);
      expect(ru.body).toMatchObject({ locale: 'ru', name: 'Новое имя' });
    });

    it('replaces the achievements of a language as a whole', async () => {
      const body = validCase('ach', {
        translations: {
          ru: text('ach', 'ru', {
            achievements: [
              { title: '1', description: '1', metric: '1' },
              { title: '2', description: '2', metric: '2' },
              { title: '3', description: '3', metric: '3' },
            ],
          }),
        },
      });
      await post(body).expect(201);
      const next = [{ title: 'only', description: 'one', metric: '!' }];

      const res = await patch(body.slug, {
        translations: { ru: { achievements: next } },
      }).expect(200);

      expect(
        (res.body as { translations: Record<Lang, Body> }).translations.ru
          .achievements,
      ).toEqual(next);
    });

    it('creates a missing language from a complete translation', async () => {
      const body = validCase('new-lang');
      await post(body).expect(201);

      const res = await patch(body.slug, {
        translations: { en: text('new-lang', 'en') },
      }).expect(200);

      expect((res.body as { translations: Body }).translations.en).toEqual(
        text('new-lang', 'en'),
      );
      expect(await storedTranslations(body.slug)).toHaveLength(2);
    });

    it('responds 400 for a partial translation of a missing language', async () => {
      const body = validCase('partial-lang');
      await post(body).expect(201);

      await patch(body.slug, {
        translations: { en: { name: 'Only a name' } },
      }).expect(400);

      expect(await storedTranslations(body.slug)).toHaveLength(1);
    });

    it.each([
      ['a slug in the body', { slug: 'other' }],
      ['an unknown language', { translations: { de: { name: 'x' } } }],
      ['an unknown translation field', { translations: { ru: { foo: 1 } } }],
      ['an old flat name', { name: 'Old' }],
    ])('responds 400 for %s', async (_name, change) => {
      const body = validCase('bad-patch');
      if (!created.includes(String(body.slug))) await post(body).expect(201);

      await patch(body.slug, change).expect(400);
    });

    it('responds 404 for an unknown case', async () => {
      await patch(slugOf('missing'), {
        translations: { ru: { name: 'x' } },
      }).expect(404);
    });
  });

  describe('DELETE /cases/:slug', () => {
    it('removes a case', async () => {
      const body = validCase('del', {
        published: true,
        translations: bothLanguages('del'),
      });
      await post(body).expect(201);

      await request(server)
        .delete(`/cases/${String(body.slug)}`)
        .set(...adminAuth())
        .expect(204);

      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(404);
    });

    it('removes the translations with the case', async () => {
      const body = validCase('del-cascade', {
        translations: bothLanguages('del-cascade'),
      });
      await post(body).expect(201);
      expect(await storedTranslations(body.slug)).toHaveLength(2);

      await request(server)
        .delete(`/cases/${String(body.slug)}`)
        .set(...adminAuth())
        .expect(204);

      expect(await storedTranslations(body.slug)).toHaveLength(0);
      const again = await post(validCase('del-cascade')).expect(201);
      expect((again.body as { translations: Body }).translations.en).toBeNull();
    });

    it('responds 404 for an unknown case', async () => {
      await request(server)
        .delete(`/cases/${slugOf('missing')}`)
        .set(...adminAuth())
        .expect(404);
    });
  });
});
