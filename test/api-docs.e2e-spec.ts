import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CaseController } from '../src/case/case.controller';
import { CaseService } from '../src/case/case.service';
import { createTestApp } from './helpers/create-test-app';

interface SchemaProperty {
  type?: string;
  format?: string;
  nullable?: boolean;
  description?: string;
  example?: unknown;
  maxLength?: number;
  minimum?: number;
  pattern?: string;
  enum?: string[];
}

interface Schema {
  type?: string;
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
  security?: Array<Record<string, string[]>>;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses: Record<
    string,
    { content?: Record<string, { schema?: { $ref?: string } }> }
  >;
}

interface OpenApiDocument {
  openapi: string;
  info: { description?: string };
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, Schema>;
    securitySchemes?: Record<
      string,
      { type?: string; scheme?: string; description?: string }
    >;
  };
}

// [method, path, documented error statuses]
const OPERATIONS: Array<[string, string, string[]]> = [
  ['post', '/cases', ['400', '401', '409']],
  ['get', '/cases', []],
  ['get', '/cases/{slug}', ['404']],
  ['patch', '/cases/{slug}', ['400', '401', '404']],
  ['delete', '/cases/{slug}', ['401', '404']],
  ['put', '/cases/{slug}/image', ['400', '401', '404', '413']],
  ['delete', '/cases/{slug}/image', ['401', '404']],
];

// operations that need the admin token, and the two that stay public
const PROTECTED = OPERATIONS.filter(([, , errors]) => errors.includes('401'));
const PUBLIC = OPERATIONS.filter(([, , errors]) => !errors.includes('401'));

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

// every `$ref` string found anywhere in the document
function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, found);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

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

  describe('generator readiness', () => {
    it('is an OpenAPI 3 document', () => {
      expect(doc.openapi).toMatch(/^3\./);
    });

    it('has no dangling $ref', () => {
      const prefix = '#/components/schemas/';
      const refs = collectRefs(doc);

      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(ref.startsWith(prefix)).toBe(true);
        expect(doc.components.schemas[ref.slice(prefix.length)]).toBeDefined();
      }
    });

    it('has no schema without properties', () => {
      for (const name of Object.keys(doc.components.schemas)) {
        expect([name, propertyNames(name).length > 0]).toEqual([name, true]);
      }
    });
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
      ['put', '/cases/{slug}/image'],
      ['delete', '/cases/{slug}/image'],
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

  describe('case image', () => {
    const IMAGE_FIELDS = ['image', 'blurImage'];

    it('PUT /cases/{slug}/image takes a multipart body with a required binary file', () => {
      const body = operation('put', '/cases/{slug}/image').requestBody;
      const multipart = body?.content?.['multipart/form-data']?.schema;

      expect(multipart?.type).toBe('object');
      expect(multipart?.required).toEqual(['file']);
      expect(multipart?.properties?.file?.type).toBe('string');
      expect(multipart?.properties?.file?.format).toBe('binary');
      expect(multipart?.properties?.file?.description?.trim()).toBeTruthy();
    });

    it('PUT /cases/{slug}/image states the accepted formats and the size limit', () => {
      const body = operation('put', '/cases/{slug}/image').requestBody;
      const description =
        body?.content?.['multipart/form-data']?.schema?.properties?.file
          ?.description ?? '';

      expect(description).toMatch(/JPEG/);
      expect(description).toMatch(/PNG/);
      expect(description).toMatch(/WebP/);
      expect(description).toMatch(/10 MB/);
    });

    it('PUT returns the case detail and DELETE answers 204', () => {
      const put = operation('put', '/cases/{slug}/image').responses;
      const del = operation('delete', '/cases/{slug}/image').responses;

      expect(put['200']?.content?.['application/json']?.schema?.$ref).toBe(
        '#/components/schemas/CaseDetailDto',
      );
      expect(del['204']).toBeDefined();
    });

    it.each(['CaseListItemDto', 'CaseDetailDto'])(
      '%s documents image and blurImage as nullable strings',
      (name) => {
        const props = schema(name).properties ?? {};

        for (const field of IMAGE_FIELDS) {
          expect(props[field]?.type).toBe('string');
          expect(props[field]?.nullable).toBe(true);
          expect(props[field]?.description?.trim()).toBeTruthy();
          expect(props[field]?.example).toBeDefined();
        }
      },
    );

    it('exposes no storage key in any schema', () => {
      for (const name of Object.keys(doc.components.schemas)) {
        expect(propertyNames(name)).not.toContain('imageKey');
      }
    });

    it.each(['CreateCaseDto', 'UpdateCaseDto'])(
      '%s does not accept the image fields',
      (name) => {
        for (const field of IMAGE_FIELDS) {
          expect(propertyNames(name)).not.toContain(field);
        }
      },
    );
  });

  describe('authentication', () => {
    const bearerSchemes = () =>
      Object.entries(doc.components.securitySchemes ?? {}).filter(
        ([, scheme]) => scheme.type === 'http' && scheme.scheme === 'bearer',
      );

    it('declares a described bearer scheme', () => {
      const schemes = bearerSchemes();

      expect(schemes).toHaveLength(1);
      expect(schemes[0]?.[1].description?.trim()).toBeTruthy();
    });

    it.each(PROTECTED)('%s %s requires the bearer scheme', (method, path) => {
      const name = bearerSchemes()[0]?.[0] ?? '';
      const security = operation(method, path).security ?? [];

      expect(security.length).toBeGreaterThan(0);
      expect(security.some((entry) => name in entry)).toBe(true);
    });

    it.each(PUBLIC)('%s %s is open', (method, path) => {
      expect(operation(method, path).security ?? []).toEqual([]);
    });

    it('does not claim that the write endpoints are unprotected', () => {
      expect(doc.info.description).not.toMatch(/not protected/i);
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
