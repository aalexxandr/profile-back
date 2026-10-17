import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

type Body = Record<string, unknown>;

describe('Case management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const tag = uniqueId('mgmt', 16);
  const created: string[] = [];

  const slugOf = (suffix: string) => `${tag}-${suffix}`;

  const validCase = (suffix: string, overrides: Body = {}): Body => ({
    slug: slugOf(suffix),
    name: `Case ${suffix}`,
    projectLink: 'https://example.com',
    category: 'Web App',
    stack: ['React', 'TypeScript'],
    shortDescription: 'Short',
    description: 'Long',
    role: 'FRONTEND',
    achievements: [{ title: 't', description: 'd', metric: 'm' }],
    startedAt: '2024-01-01',
    ...overrides,
  });

  const post = (body: Body) => {
    if (typeof body.slug === 'string') created.push(body.slug);
    return request(server).post('/cases').send(body);
  };

  const listedSlugs = async () => {
    const res = await request(server).get('/cases').expect(200);
    return (res.body as Array<{ slug: string }>).map((item) => item.slug);
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

  describe('POST /cases', () => {
    it('creates a hidden draft from the required fields only', async () => {
      const body = validCase('min');

      const res = await post(body).expect(201);

      expect(res.body).toMatchObject({
        slug: body.slug,
        name: body.name,
        company: null,
        teamSize: null,
        startedAt: '2024-01-01',
        endedAt: null,
      });
      expect(await listedSlugs()).not.toContain(body.slug);
    });

    it('creates a published case with the optional fields', async () => {
      const body = validCase('full', {
        published: true,
        company: 'Acme',
        teamSize: 5,
        sortOrder: 3,
        endedAt: '2024-06-01',
      });

      const res = await post(body).expect(201);

      expect(res.body).toMatchObject({
        company: 'Acme',
        teamSize: 5,
        startedAt: '2024-01-01',
        endedAt: '2024-06-01',
      });
      expect(await listedSlugs()).toContain(body.slug);
    });

    it('responds 409 when the slug is taken', async () => {
      const body = validCase('dup');
      await post(body).expect(201);

      await post(body).expect(409);
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
      [
        'an achievement without a metric',
        { achievements: [{ title: 't', description: 'd' }] },
      ],
      [
        '11 achievements',
        {
          achievements: Array.from({ length: 11 }, () => ({
            title: 't',
            description: 'd',
            metric: 'm',
          })),
        },
      ],
    ])('responds 400 for %s', async (_name, overrides) => {
      const body = validCase('bad', overrides);
      // only a valid slug could ever reach the DB; nothing to clean up here
      await request(server).post('/cases').send(body).expect(400);
    });
  });

  describe('PATCH /cases/:slug', () => {
    it('publishes a draft', async () => {
      const body = validCase('publish');
      await post(body).expect(201);

      const res = await request(server)
        .patch(`/cases/${String(body.slug)}`)
        .send({ published: true })
        .expect(200);

      expect(res.body).toMatchObject({ slug: body.slug });
      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(200);
    });

    it('keeps the fields that are not in the body', async () => {
      const body = validCase('keep', { company: 'Acme', teamSize: 4 });
      const before = (await post(body).expect(201)).body as Body;

      const res = await request(server)
        .patch(`/cases/${String(body.slug)}`)
        .send({ name: 'New name' })
        .expect(200);

      expect(res.body).toEqual({ ...before, name: 'New name' });
    });

    it('responds 400 when the body contains a slug', async () => {
      const body = validCase('slug');
      await post(body).expect(201);

      await request(server)
        .patch(`/cases/${String(body.slug)}`)
        .send({ slug: 'other' })
        .expect(400);
    });

    it('responds 404 for an unknown case', async () => {
      await request(server)
        .patch(`/cases/${slugOf('missing')}`)
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /cases/:slug', () => {
    it('removes a case', async () => {
      const body = validCase('del', { published: true });
      await post(body).expect(201);

      await request(server)
        .delete(`/cases/${String(body.slug)}`)
        .expect(204);

      await request(server)
        .get(`/cases/${String(body.slug)}`)
        .expect(404);
    });

    it('responds 404 for an unknown case', async () => {
      await request(server)
        .delete(`/cases/${slugOf('missing')}`)
        .expect(404);
    });
  });
});
