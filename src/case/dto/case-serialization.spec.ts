import {
  CallHandler,
  ClassSerializerInterceptor,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

import { CaseController } from '../case.controller';
import { caseAdminView, caseView } from '../case.fixtures';

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
  'blurImage',
  'category',
  'image',
  'locale',
  'name',
  'projectLink',
  'shortDescription',
  'slug',
  'stack',
];

const DETAIL_KEYS = [
  'achievements',
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
];

const ADMIN_KEYS = [
  'blurImage',
  'company',
  'endedAt',
  'image',
  'projectLink',
  'published',
  'role',
  'slug',
  'sortOrder',
  'stack',
  'startedAt',
  'teamSize',
  'translations',
];

const TRANSLATION_KEYS = [
  'achievements',
  'category',
  'description',
  'name',
  'shortDescription',
];

describe('case response serialization', () => {
  describe('list item (findAll)', () => {
    it('exposes exactly the compact list fields', async () => {
      const items = (await serialize('findAll', [
        caseView({ slug: 'a' }),
        caseView({ slug: 'b' }),
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

    it('sends the picture URL and the blur placeholder', async () => {
      const items = (await serialize('findAll', [
        caseView({
          image: 'https://cdn.test/cases/spectre/ab12.webp',
          imageKey: 'cases/spectre/ab12.webp',
          blurImage: 'data:image/webp;base64,AAAA',
        }),
      ])) as unknown[];

      expect(items[0]).toMatchObject({
        image: 'https://cdn.test/cases/spectre/ab12.webp',
        blurImage: 'data:image/webp;base64,AAAA',
      });
      expect(items[0]).not.toHaveProperty('imageKey');
    });

    it('sends null for both picture fields when there is no picture', async () => {
      const items = (await serialize('findAll', [caseView()])) as unknown[];

      expect(items[0]).toMatchObject({ image: null, blurImage: null });
    });

    it('serializes an empty list as an empty list', async () => {
      await expect(serialize('findAll', [])).resolves.toEqual([]);
    });
  });

  describe.each(['findBySlug'] as const)('detail (%s)', (handler) => {
    it('exposes the detail fields with flat dates', async () => {
      const detail = await serialize(handler, caseView());

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
      const detail = await serialize(
        handler,
        caseView({ imageKey: 'cases/spectre/ab12.webp' }),
      );

      for (const key of [
        'imageKey',
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
        caseView({ company: null, teamSize: null, endedAt: null }),
      );

      expect(detail).toMatchObject({
        company: null,
        teamSize: null,
        endedAt: null,
        image: null,
        blurImage: null,
      });
    });

    it('sends the picture URL and the blur placeholder', async () => {
      const detail = await serialize(
        handler,
        caseView({
          image: 'https://cdn.test/cases/spectre/ab12.webp',
          blurImage: 'data:image/webp;base64,AAAA',
        }),
      );

      expect(detail).toMatchObject({
        image: 'https://cdn.test/cases/spectre/ab12.webp',
        blurImage: 'data:image/webp;base64,AAAA',
      });
    });

    it('reduces each achievement to its three fields', async () => {
      const row = {
        ...caseView(),
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
  });

  describe('localized text in the public views', () => {
    it('sends the served language next to the text on a list item', async () => {
      const items = (await serialize('findAll', [
        caseView({ locale: 'en', name: 'Spectre' }),
      ])) as unknown[];

      expect(items[0]).toMatchObject({ locale: 'en', name: 'Spectre' });
      expect(items[0]).not.toHaveProperty('translations');
    });

    it('sends the served language next to the text on the detail', async () => {
      const detail = await serialize(
        'findBySlug',
        caseView({ locale: 'en', description: 'English text' }),
      );

      expect(detail).toMatchObject({
        locale: 'en',
        description: 'English text',
      });
      expect(detail).not.toHaveProperty('translations');
    });
  });

  describe.each(['createCase', 'updateCase', 'setImage'] as const)(
    'full view (%s)',
    (handler) => {
      it('exposes the shared fields and all translations, without locale', async () => {
        const view = await serialize(handler, caseAdminView());

        expect(sortedKeys(view)).toEqual(ADMIN_KEYS);
        expect(view).toMatchObject({
          slug: 'spectre',
          role: 'FRONTEND',
          company: 'Acme',
          teamSize: 5,
          startedAt: '2024-01-01',
          endedAt: '2024-06-01',
          sortOrder: 2,
          published: true,
        });
        expect(view).not.toHaveProperty('locale');
        expect(view).not.toHaveProperty('name');
      });

      it('exposes exactly the five text fields of each translation', async () => {
        const view = (await serialize(handler, caseAdminView())) as {
          translations: { ru: unknown; en: unknown };
        };

        expect(sortedKeys(view.translations)).toEqual(['en', 'ru']);
        expect(sortedKeys(view.translations.ru)).toEqual(TRANSLATION_KEYS);
        expect(sortedKeys(view.translations.en)).toEqual(TRANSLATION_KEYS);
        expect(view.translations.en).toMatchObject({ name: 'Spectre' });
      });

      it('sends null for a language that does not exist yet', async () => {
        const view = (await serialize(
          handler,
          caseAdminView({
            translations: { ru: caseAdminView().translations.ru, en: null },
          }),
        )) as { translations: { ru: unknown; en: unknown } };

        expect(view.translations.en).toBeNull();
        expect(sortedKeys(view.translations.ru)).toEqual(TRANSLATION_KEYS);
      });

      it('does not expose the storage key and reduces achievements', async () => {
        const base = caseAdminView();
        const view = (await serialize(handler, {
          ...base,
          imageKey: 'cases/spectre/ab12.webp',
          translations: {
            ru: {
              ...base.translations.ru,
              achievements: [
                { title: 'a', description: 'b', metric: 'c', internal: 'x' },
              ],
            },
            en: base.translations.en,
          },
        })) as {
          translations: { ru: { achievements: unknown[] } };
        };

        expect(view).not.toHaveProperty('imageKey');
        expect(view.translations.ru.achievements).toEqual([
          { title: 'a', description: 'b', metric: 'c' },
        ]);
      });

      it('sends the picture URL and the blur placeholder', async () => {
        const view = await serialize(
          handler,
          caseAdminView({
            image: 'https://cdn.test/cases/spectre/ab12.webp',
            blurImage: 'data:image/webp;base64,AAAA',
          }),
        );

        expect(view).toMatchObject({
          image: 'https://cdn.test/cases/spectre/ab12.webp',
          blurImage: 'data:image/webp;base64,AAAA',
        });
      });
    },
  );
});
