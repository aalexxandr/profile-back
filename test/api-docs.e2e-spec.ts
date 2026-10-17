import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CaseController } from '../src/case/case.controller';
import { CaseService } from '../src/case/case.service';
import { createTestApp } from './helpers/create-test-app';

interface SchemaProperty {
  type?: string;
  maxLength?: number;
  minimum?: number;
  pattern?: string;
  enum?: string[];
}

interface Schema {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface Parameter {
  name: string;
  in: string;
  description?: string;
  example?: unknown;
  schema?: { example?: unknown };
}

interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  responses: Record<
    string,
    { content?: Record<string, { schema?: { $ref?: string } }> }
  >;
}

interface OpenApiDocument {
  info: { description?: string };
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

// [method, path, documented error statuses]
const OPERATIONS: Array<[string, string, string[]]> = [
  ['post', '/cases', ['400', '409']],
  ['get', '/cases', []],
  ['get', '/cases/{slug}', ['404']],
  ['patch', '/cases/{slug}', ['400', '404']],
  ['delete', '/cases/{slug}', ['404']],
];

const CREATE_FIELDS = [
  'achievements',
  'category',
  'company',
  'description',
  'endedAt',
  'name',
  'projectLink',
  'published',
  'role',
  'shortDescription',
  'slug',
  'sortOrder',
  'stack',
  'startedAt',
  'teamSize',
];

const CREATE_REQUIRED = [
  'achievements',
  'category',
  'description',
  'name',
  'projectLink',
  'role',
  'shortDescription',
  'slug',
  'stack',
  'startedAt',
];

describe('API documentation (e2e)', () => {
  let app: INestApplication;
  let doc: OpenApiDocument;

  const operation = (method: string, path: string) => {
    const found = doc.paths[path]?.[method];
    if (!found)
      throw new Error(`${method.toUpperCase()} ${path} is not documented`);
    return found;
  };
  const schema = (name: string): Schema => {
    const found = doc.components.schemas[name];
    if (!found) throw new Error(`schema ${name} is not documented`);
    return found;
  };
  const propertyNames = (name: string) =>
    Object.keys(schema(name).properties ?? {}).sort();

  beforeAll(async () => {
    // no DB: the real controller with a stubbed service
    app = await createTestApp({
      controllers: [CaseController],
      providers: [{ provide: CaseService, useValue: {} }],
    });
    const res = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/docs-json')
      .expect(200);
    doc = res.body as OpenApiDocument;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('operations', () => {
    it.each(OPERATIONS)(
      '%s %s has a summary and a description',
      (method, path) => {
        const op = operation(method, path);

        expect(op.summary?.trim()).toBeTruthy();
        expect(op.description?.trim()).toBeTruthy();
      },
    );

    it('describes the document and the tag the operations use', () => {
      expect(doc.info.description?.trim()).toBeTruthy();
      for (const [method, path] of OPERATIONS) {
        for (const tag of operation(method, path).tags ?? []) {
          const described = doc.tags?.find((t) => t.name === tag);
          expect(described?.description?.trim()).toBeTruthy();
        }
      }
    });
  });

  describe('path parameters', () => {
    it.each([
      ['get', '/cases/{slug}'],
      ['patch', '/cases/{slug}'],
      ['delete', '/cases/{slug}'],
    ])(
      '%s %s documents slug with a description and an example',
      (method, path) => {
        const slug = operation(method, path).parameters?.find(
          (p) => p.name === 'slug' && p.in === 'path',
        );

        expect(slug?.description?.trim()).toBeTruthy();
        expect(slug?.example ?? slug?.schema?.example).toBeDefined();
      },
    );
  });

  describe('request bodies', () => {
    it('CreateCaseDto lists every accepted field', () => {
      expect(propertyNames('CreateCaseDto')).toEqual(CREATE_FIELDS);
    });

    it('CreateCaseDto separates required from optional fields', () => {
      expect([...(schema('CreateCaseDto').required ?? [])].sort()).toEqual(
        CREATE_REQUIRED,
      );
    });

    it('CreateCaseDto shows the constraints the API enforces', () => {
      const props = schema('CreateCaseDto').properties ?? {};

      expect(props.slug?.maxLength).toBe(50);
      expect(props.slug?.pattern).toBeTruthy();
      expect(props.teamSize?.minimum).toBe(1);
      expect([...(props.role?.enum ?? [])].sort()).toEqual([
        'FRONTEND',
        'FULLSTACK',
      ]);
    });

    it('UpdateCaseDto is partial and has no slug', () => {
      const names = propertyNames('UpdateCaseDto');

      expect(names).not.toContain('slug');
      expect(names).toEqual(CREATE_FIELDS.filter((f) => f !== 'slug'));
      expect(schema('UpdateCaseDto').required ?? []).toEqual([]);
    });

    it('AchievementDto describes its three required fields', () => {
      expect(propertyNames('AchievementDto')).toEqual([
        'description',
        'metric',
        'title',
      ]);
      expect([...(schema('AchievementDto').required ?? [])].sort()).toEqual([
        'description',
        'metric',
        'title',
      ]);
    });
  });

  describe('error responses', () => {
    it.each(OPERATIONS)(
      '%s %s documents exactly its error statuses with ErrorResponseDto',
      (method, path, errorStatuses) => {
        const responses = operation(method, path).responses;
        const errors = Object.keys(responses)
          .filter((status) => Number(status) >= 400)
          .sort();

        expect(errors).toEqual(errorStatuses);
        for (const status of errors) {
          expect(
            responses[status]?.content?.['application/json']?.schema?.$ref,
          ).toBe('#/components/schemas/ErrorResponseDto');
        }
      },
    );

    it('ErrorResponseDto matches the real error body', () => {
      expect(propertyNames('ErrorResponseDto')).toEqual([
        'message',
        'path',
        'status',
        'timestamp',
      ]);
    });
  });
});
