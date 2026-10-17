import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

type Body = Record<string, unknown>;

describe('Case catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const tag = uniqueId('cat', 16);
  const created: string[] = [];

  const seed = async (suffix: string, overrides: Body = {}) => {
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
      published: true,
      ...overrides,
    });
    created.push(slug);
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
          'category',
          'name',
          'shortDescription',
          'slug',
          'stack',
        ]);
      }
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
        'category',
        'company',
        'description',
        'endedAt',
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
        achievements: [{ title: 't', description: 'd', metric: 'm' }],
      });
    });

    it('returns null, not nothing, for absent optional fields', async () => {
      const slug = await seed('nulls');

      const res = await request(server).get(`/cases/${slug}`).expect(200);

      expect(res.body).toMatchObject({
        company: null,
        teamSize: null,
        endedAt: null,
      });
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
