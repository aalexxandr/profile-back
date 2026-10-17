import {
  CallHandler,
  ClassSerializerInterceptor,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

import { CaseController } from '../case.controller';
import { caseRow } from '../case.fixtures';

type Handler = keyof CaseController;

// Runs a response through the real interceptor with the options declared on
// the real controller method, as Nest does for an HTTP request.
const serialize = async (handler: Handler, body: unknown): Promise<unknown> => {
  const method = Object.getOwnPropertyDescriptor(
    CaseController.prototype,
    handler,
  )?.value as () => void;
  const context = {
    getHandler: () => method,
    getClass: () => CaseController,
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(body) };

  const interceptor = new ClassSerializerInterceptor(new Reflector());
  return lastValueFrom(await interceptor.intercept(context, next));
};

const sortedKeys = (value: unknown) => Object.keys(value as object).sort();

const LIST_ITEM_KEYS = [
  'category',
  'name',
  'shortDescription',
  'slug',
  'stack',
];

const DETAIL_KEYS = [
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
];

describe('case response serialization', () => {
  describe('list item (findAll)', () => {
    it('exposes exactly the compact list fields', async () => {
      const items = (await serialize('findAll', [
        caseRow({ slug: 'a' }),
        caseRow({ slug: 'b' }),
      ])) as unknown[];

      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(sortedKeys(item)).toEqual(LIST_ITEM_KEYS);
      }
      expect(items[0]).toMatchObject({
        slug: 'a',
        stack: ['React', 'TypeScript'],
      });
    });

    it('serializes an empty list as an empty list', async () => {
      await expect(serialize('findAll', [])).resolves.toEqual([]);
    });
  });

  describe.each(['findBySlug', 'createCase', 'updateCase'] as const)(
    'detail (%s)',
    (handler) => {
      it('exposes the detail fields with flat dates', async () => {
        const detail = await serialize(handler, caseRow());

        expect(sortedKeys(detail)).toEqual(DETAIL_KEYS);
        expect(detail).toMatchObject({
          slug: 'spectre',
          role: 'FRONTEND',
          company: 'Acme',
          teamSize: 5,
          startedAt: '2024-01-01',
          endedAt: '2024-06-01',
        });
        expect(detail).not.toHaveProperty('period');
      });

      it('does not expose internal columns', async () => {
        const detail = await serialize(handler, caseRow());

        for (const key of [
          'published',
          'sortOrder',
          'createdAt',
          'updatedAt',
        ]) {
          expect(detail).not.toHaveProperty(key);
        }
      });

      it('keeps absent optional values as null', async () => {
        const detail = await serialize(
          handler,
          caseRow({ company: null, teamSize: null, endedAt: null }),
        );

        expect(detail).toMatchObject({
          company: null,
          teamSize: null,
          endedAt: null,
        });
      });

      it('reduces each achievement to its three fields', async () => {
        const row = {
          ...caseRow(),
          achievements: [
            { title: 'a', description: 'b', metric: 'c', internal: 'x' },
          ],
        };

        const detail = (await serialize(handler, row)) as {
          achievements: unknown[];
        };

        expect(detail.achievements).toEqual([
          { title: 'a', description: 'b', metric: 'c' },
        ]);
      });
    },
  );
});
