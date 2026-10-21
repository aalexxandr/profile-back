import { createHash } from 'node:crypto';

import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { ProcessedImage } from '../image/image.types';
import { ImageProcessingService } from '../image/image-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  caseRow,
  caseText,
  caseWithTranslations,
  translationRow,
} from './case.fixtures';
import { CaseService } from './case.service';
import type {
  CaseRow,
  CaseTranslationRow,
  CaseWithTranslations,
} from './case.types';
import type { CaseTranslationDto } from './dto/case-translation.dto';
import type { CreateCaseDto } from './dto/create-case.dto';
import type { UpdateCaseDto } from './dto/update-case.dto';

const text = (overrides: Partial<CaseTranslationDto> = {}) => ({
  name: 'Спектр',
  category: 'Финтех',
  shortDescription: 'Обозреватель',
  description: 'Описание',
  achievements: [{ title: 'a', description: 'b', metric: 'c' }],
  ...overrides,
});

const englishText = (overrides: Partial<CaseTranslationDto> = {}) =>
  text({ name: 'Spectre', category: 'FinTech', ...overrides });

const createDto = (overrides: Partial<CreateCaseDto> = {}): CreateCaseDto => ({
  slug: 'spectre',
  projectLink: 'https://thespectre.io',
  stack: ['React'],
  role: 'FRONTEND',
  startedAt: '2024-01-01',
  translations: { ru: text() },
  ...overrides,
});

// stands in for the ORM row accessor: each direction reports what it was asked
interface FakeRow {
  sortOrder: { asc: () => string };
  createdAt: { desc: () => string };
}
const fakeRow: FakeRow = {
  sortOrder: { asc: () => 'sortOrder asc' },
  createdAt: { desc: () => 'createdAt desc' },
};

const publicUrl = (key: string) => `https://cdn.test/${key}`;

describe('CaseService', () => {
  // reads outside a transaction: cases.where(...).orderBy(...).include('translations').all()
  const first = jest.fn<Promise<CaseRow | null>, [Record<string, unknown>]>();
  const all = jest.fn<Promise<CaseWithTranslations[]>, []>();
  const findOne = jest.fn<Promise<CaseWithTranslations | null>, []>();
  const include = jest.fn((_relation: string) => ({ all, first: findOne }));
  type Order = (row: FakeRow) => unknown;
  const orderBy = jest.fn((_order: Order[]) => ({ include }));
  const where = jest.fn((_filter: Record<string, unknown>) => ({
    orderBy,
    include,
  }));
  const update = jest.fn<Promise<CaseRow | null>, [Record<string, unknown>]>();
  const remove = jest.fn<Promise<CaseRow | null>, []>();
  const whereUnique = jest.fn((_criterion: { slug: string }) => ({
    update,
    delete: remove,
  }));
  const translationsAll = jest.fn<Promise<CaseTranslationRow[]>, []>();
  const translationsWhere = jest.fn((_filter: Record<string, unknown>) => ({
    all: translationsAll,
  }));

  // everything inside prisma.transaction(...)
  const txFind = jest.fn<Promise<CaseWithTranslations | null>, []>();
  const txInclude = jest.fn((_relation: string) => ({ first: txFind }));
  const txCaseWhere = jest.fn((_filter: Record<string, unknown>) => ({
    include: txInclude,
  }));
  const txCaseCreate = jest.fn<Promise<CaseRow>, [Record<string, unknown>]>();
  const txCaseUpdate = jest.fn<
    Promise<CaseRow | null>,
    [Record<string, unknown>]
  >();
  const txCaseWhereUnique = jest.fn((_criterion: { slug: string }) => ({
    update: txCaseUpdate,
  }));
  const txTranslationCreate = jest.fn<
    Promise<CaseTranslationRow>,
    [Record<string, unknown>]
  >();
  const txTranslationUpdate = jest.fn<
    Promise<CaseTranslationRow | null>,
    [Record<string, unknown>]
  >();
  const txTranslationWhere = jest.fn((_filter: Record<string, unknown>) => ({
    update: txTranslationUpdate,
  }));
  const tx = {
    orm: {
      public: {
        Case: {
          create: txCaseCreate,
          where: txCaseWhere,
          whereUnique: txCaseWhereUnique,
        },
        CaseTranslation: {
          create: txTranslationCreate,
          where: txTranslationWhere,
        },
      },
    },
  };
  const transaction = jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
    fn(tx),
  );

  const storagePublicUrl = jest.fn<string, [string]>();
  const storagePut = jest.fn<Promise<void>, [string, Buffer, string]>();
  const storageDelete = jest.fn<Promise<void>, [string]>();
  const processImage = jest.fn<Promise<ProcessedImage>, [Buffer]>();
  let service: CaseService;

  beforeEach(async () => {
    jest.resetAllMocks();
    include.mockImplementation(() => ({ all, first: findOne }));
    orderBy.mockImplementation(() => ({ include }));
    where.mockImplementation(() => ({ orderBy, include }));
    whereUnique.mockImplementation(() => ({ update, delete: remove }));
    translationsWhere.mockImplementation(() => ({ all: translationsAll }));
    txInclude.mockImplementation(() => ({ first: txFind }));
    txCaseWhere.mockImplementation(() => ({ include: txInclude }));
    txCaseWhereUnique.mockImplementation(() => ({ update: txCaseUpdate }));
    txTranslationWhere.mockImplementation(() => ({
      update: txTranslationUpdate,
    }));
    transaction.mockImplementation((fn) => fn(tx));
    // the database echoes back what it was given
    txCaseCreate.mockImplementation((data) =>
      Promise.resolve(caseRow(data as Partial<CaseRow>)),
    );
    txCaseUpdate.mockImplementation((data) =>
      Promise.resolve(caseRow(data as Partial<CaseRow>)),
    );
    txTranslationCreate.mockImplementation((data) =>
      Promise.resolve(translationRow(data as Partial<CaseTranslationRow>)),
    );
    txTranslationUpdate.mockImplementation((data) =>
      Promise.resolve(translationRow(data as Partial<CaseTranslationRow>)),
    );
    storagePublicUrl.mockImplementation(publicUrl);
    storagePut.mockResolvedValue();
    storageDelete.mockResolvedValue();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: PrismaService,
          useValue: {
            cases: { first, where, whereUnique },
            caseTranslations: { where: translationsWhere },
            transaction,
          },
        },
        {
          provide: StorageService,
          useValue: {
            publicUrl: storagePublicUrl,
            put: storagePut,
            delete: storageDelete,
          },
        },
        {
          provide: ImageProcessingService,
          useValue: { process: processImage },
        },
      ],
    }).compile();
    service = moduleRef.get(CaseService);
  });

  describe('findAll', () => {
    it('lists only published cases with their translations, ordered by sortOrder then newest first', async () => {
      all.mockResolvedValue([]);

      await service.findAll('ru');

      expect(where).toHaveBeenCalledWith({ published: true });
      expect(include).toHaveBeenCalledWith('translations');
      const [order] = orderBy.mock.calls[0] ?? [];
      expect(order?.map((by) => by(fakeRow))).toEqual([
        'sortOrder asc',
        'createdAt desc',
      ]);
    });

    it('returns the text of the requested language with its locale', async () => {
      all.mockResolvedValue([caseWithTranslations({ slug: 'a' })]);

      const [item] = await service.findAll('en');

      expect(item).toMatchObject({ slug: 'a', locale: 'en', name: 'Spectre' });
    });

    it('returns Russian text when no language is requested explicitly', async () => {
      all.mockResolvedValue([caseWithTranslations()]);

      const [item] = await service.findAll('ru');

      expect(item).toMatchObject({ locale: 'ru', name: 'Спектр' });
    });

    it('falls back to the Russian text, and says so, when the requested translation is missing', async () => {
      all.mockResolvedValue([
        caseWithTranslations({}, [translationRow({ locale: 'ru' })]),
      ]);

      const [item] = await service.findAll('en');

      expect(item).toMatchObject({ locale: 'ru', name: 'Спектр' });
    });

    it('skips a published case that has no translation to serve instead of failing the list', async () => {
      all.mockResolvedValue([
        caseWithTranslations({ slug: 'broken' }, []),
        caseWithTranslations({ slug: 'fine' }),
      ]);

      const items = await service.findAll('ru');

      expect(items.map((item) => item.slug)).toEqual(['fine']);
    });

    it('does not expose the translations array in the view', async () => {
      all.mockResolvedValue([caseWithTranslations()]);

      const [item] = await service.findAll('en');

      expect(item).not.toHaveProperty('translations');
    });

    it('returns an empty list when nothing is published', async () => {
      all.mockResolvedValue([]);

      await expect(service.findAll('en')).resolves.toEqual([]);
    });

    it('adds the public picture URL to rows that have one and null to the rest', async () => {
      all.mockResolvedValue([
        caseWithTranslations({
          slug: 'with',
          imageKey: 'cases/with/ab12.webp',
        }),
        caseWithTranslations({ slug: 'without', imageKey: null }),
      ]);

      const views = await service.findAll('ru');

      expect(views.map((view) => view.image)).toEqual([
        'https://cdn.test/cases/with/ab12.webp',
        null,
      ]);
    });
  });

  describe('findBySlug', () => {
    it('returns the published case in the requested language', async () => {
      findOne.mockResolvedValue(caseWithTranslations({ slug: 'spectre' }));

      await expect(service.findBySlug('spectre', 'en')).resolves.toMatchObject({
        slug: 'spectre',
        locale: 'en',
        name: 'Spectre',
        description: caseText().description,
      });
    });

    it('asks only for published cases and loads the translations', async () => {
      findOne.mockResolvedValue(caseWithTranslations());

      await service.findBySlug('spectre', 'ru');

      expect(where).toHaveBeenCalledWith({ slug: 'spectre', published: true });
      expect(include).toHaveBeenCalledWith('translations');
    });

    it('falls back to the Russian text when the requested translation is missing', async () => {
      findOne.mockResolvedValue(
        caseWithTranslations({}, [translationRow({ locale: 'ru' })]),
      );

      await expect(service.findBySlug('spectre', 'en')).resolves.toMatchObject({
        locale: 'ru',
        name: 'Спектр',
      });
    });

    it('throws NotFoundException when no published case matches', async () => {
      findOne.mockResolvedValue(null);

      await expect(
        service.findBySlug('draft-or-unknown', 'ru'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException instead of failing when the case has no translation to serve', async () => {
      findOne.mockResolvedValue(caseWithTranslations({}, []));

      await expect(service.findBySlug('spectre', 'ru')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('adds the public picture URL built from the stored key', async () => {
      findOne.mockResolvedValue(
        caseWithTranslations({ imageKey: 'cases/spectre/ab12.webp' }),
      );

      const view = await service.findBySlug('spectre', 'ru');

      expect(view.image).toBe('https://cdn.test/cases/spectre/ab12.webp');
      expect(storagePublicUrl).toHaveBeenCalledWith('cases/spectre/ab12.webp');
    });
  });

  describe('createCase', () => {
    it('writes the case and each of its translations in one transaction', async () => {
      await service.createCase(
        createDto({
          published: true,
          translations: { ru: text(), en: englishText() },
        }),
      );

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'spectre',
          projectLink: 'https://thespectre.io',
          stack: ['React'],
          role: 'FRONTEND',
        }),
      );
      expect(txTranslationCreate).toHaveBeenCalledTimes(2);
      expect(txTranslationCreate).toHaveBeenCalledWith({
        caseSlug: 'spectre',
        locale: 'ru',
        ...text(),
      });
      expect(txTranslationCreate).toHaveBeenCalledWith({
        caseSlug: 'spectre',
        locale: 'en',
        ...englishText(),
      });
    });

    it('does not put the text into the cases row', async () => {
      await service.createCase(createDto());

      const [data] = txCaseCreate.mock.calls[0] ?? [];
      for (const key of [
        'name',
        'category',
        'shortDescription',
        'description',
        'achievements',
        'translations',
      ]) {
        expect(data).not.toHaveProperty(key);
      }
    });

    it('creates only the Russian translation for a draft and reports English as null', async () => {
      const view = await service.createCase(createDto());

      expect(txTranslationCreate).toHaveBeenCalledTimes(1);
      expect(view.translations.en).toBeNull();
      expect(view.translations.ru).toMatchObject({ name: 'Спектр' });
    });

    it('returns the full view with the stored text of every language', async () => {
      const view = await service.createCase(
        createDto({ translations: { ru: text(), en: englishText() } }),
      );

      expect(view).toMatchObject({ slug: 'spectre', image: null });
      expect(view.translations.ru).toEqual(text());
      expect(view.translations.en).toEqual(englishText());
      expect(view).not.toHaveProperty('locale');
    });

    it('refuses to publish without an English translation and writes nothing', async () => {
      await expect(
        service.createCase(createDto({ published: true })),
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(txCaseCreate).not.toHaveBeenCalled();
    });

    it('defaults to an unpublished case without optional values', async () => {
      await service.createCase(createDto());

      expect(txCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          published: false,
          sortOrder: 0,
          company: null,
          teamSize: null,
          endedAt: null,
        }),
      );
    });

    it('keeps the optional values that were given', async () => {
      await service.createCase(
        createDto({
          published: true,
          sortOrder: 3,
          company: 'Acme',
          teamSize: 5,
          endedAt: '2024-06-01',
          translations: { ru: text(), en: englishText() },
        }),
      );

      expect(txCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          published: true,
          sortOrder: 3,
          company: 'Acme',
          teamSize: 5,
          endedAt: '2024-06-01',
        }),
      );
    });

    it('does not set the picture columns: a new case has no picture', async () => {
      await service.createCase(createDto());

      const [data] = txCaseCreate.mock.calls[0] ?? [];
      expect(data).not.toHaveProperty('imageKey');
      expect(data).not.toHaveProperty('blurImage');
    });

    it('lets a database error propagate unchanged and creates no translation', async () => {
      const error = new Error('database error');
      txCaseCreate.mockRejectedValue(error);

      await expect(service.createCase(createDto())).rejects.toBe(error);

      expect(txTranslationCreate).not.toHaveBeenCalled();
    });

    it('lets a failing translation write propagate so the transaction rolls back', async () => {
      const error = new Error('database error');
      txTranslationCreate.mockRejectedValue(error);

      await expect(service.createCase(createDto())).rejects.toBe(error);
    });
  });

  describe('updateCase', () => {
    beforeEach(() => {
      txFind.mockResolvedValue(caseWithTranslations({ published: false }));
    });

    const bothLanguagesPublished = () =>
      caseWithTranslations({ published: true });
    const russianOnlyDraft = () =>
      caseWithTranslations({ published: false }, [
        translationRow({ locale: 'ru' }),
      ]);

    it('looks the case up with its translations, drafts included', async () => {
      await service.updateCase('spectre', { projectLink: 'https://a.test' });

      expect(txCaseWhere).toHaveBeenCalledWith({ slug: 'spectre' });
      expect(txInclude).toHaveBeenCalledWith('translations');
    });

    it('throws NotFoundException for an unknown case and writes nothing', async () => {
      txFind.mockResolvedValue(null);

      await expect(
        service.updateCase('does-not-exist', { company: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(txCaseUpdate).not.toHaveBeenCalled();
      expect(txTranslationUpdate).not.toHaveBeenCalled();
    });

    it('updates the shared columns of the case with the given fields only', async () => {
      await service.updateCase('spectre', {
        company: 'Acme',
        teamSize: 7,
      } satisfies UpdateCaseDto);

      expect(txCaseWhereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
      expect(txCaseUpdate).toHaveBeenCalledWith({
        company: 'Acme',
        teamSize: 7,
      });
      expect(txTranslationUpdate).not.toHaveBeenCalled();
      expect(txTranslationCreate).not.toHaveBeenCalled();
    });

    it('does not touch the cases row when only translations are sent', async () => {
      await service.updateCase('spectre', {
        translations: { en: { name: 'New name' } },
      });

      expect(txCaseUpdate).not.toHaveBeenCalled();
    });

    it('does not write anything for an empty body and returns the current state', async () => {
      txFind.mockResolvedValue(caseWithTranslations({ company: 'Kept' }));

      const view = await service.updateCase('spectre', {});

      expect(txCaseUpdate).not.toHaveBeenCalled();
      expect(txTranslationUpdate).not.toHaveBeenCalled();
      expect(view).toMatchObject({ company: 'Kept' });
    });

    it('merges one field into one language and leaves everything else as stored', async () => {
      txFind.mockResolvedValue(bothLanguagesPublished());

      const view = await service.updateCase('spectre', {
        translations: { en: { name: 'New name' } },
      });

      expect(txTranslationWhere).toHaveBeenCalledWith({
        caseSlug: 'spectre',
        locale: 'en',
      });
      expect(txTranslationUpdate).toHaveBeenCalledTimes(1);
      expect(txTranslationUpdate).toHaveBeenCalledWith({ name: 'New name' });
      expect(view.translations.en).toMatchObject({
        name: 'New name',
        description: caseText().description,
      });
      expect(view.translations.ru).toMatchObject({ name: 'Спектр' });
    });

    it('updates both languages when both are sent', async () => {
      txFind.mockResolvedValue(bothLanguagesPublished());

      const view = await service.updateCase('spectre', {
        translations: {
          ru: { category: 'Новая' },
          en: { category: 'New' },
        },
      });

      expect(txTranslationUpdate).toHaveBeenCalledTimes(2);
      expect(view.translations.ru?.category).toBe('Новая');
      expect(view.translations.en?.category).toBe('New');
    });

    it('replaces achievements as a whole array', async () => {
      txFind.mockResolvedValue(bothLanguagesPublished());
      const achievements = [{ title: 'one', description: 'two', metric: '3' }];

      const view = await service.updateCase('spectre', {
        translations: { ru: { achievements } },
      });

      expect(txTranslationUpdate).toHaveBeenCalledWith({ achievements });
      expect(view.translations.ru?.achievements).toEqual(achievements);
    });

    it('creates a missing language when a complete translation is sent', async () => {
      txFind.mockResolvedValue(russianOnlyDraft());

      const view = await service.updateCase('spectre', {
        translations: { en: englishText() },
      });

      expect(txTranslationCreate).toHaveBeenCalledWith({
        caseSlug: 'spectre',
        locale: 'en',
        ...englishText(),
      });
      expect(txTranslationUpdate).not.toHaveBeenCalled();
      expect(view.translations.en).toEqual(englishText());
    });

    it('rejects a partial translation for a missing language and writes nothing', async () => {
      txFind.mockResolvedValue(russianOnlyDraft());

      await expect(
        service.updateCase('spectre', {
          translations: { en: { name: 'Only a name' } },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(txTranslationCreate).not.toHaveBeenCalled();
      expect(txCaseUpdate).not.toHaveBeenCalled();
    });

    it('refuses to publish a case that has no English translation and writes nothing', async () => {
      txFind.mockResolvedValue(russianOnlyDraft());

      await expect(
        service.updateCase('spectre', { published: true }),
      ).rejects.toThrow(BadRequestException);

      expect(txCaseUpdate).not.toHaveBeenCalled();
      expect(txTranslationCreate).not.toHaveBeenCalled();
    });

    it('publishes a draft that has both languages', async () => {
      txFind.mockResolvedValue(caseWithTranslations({ published: false }));

      await service.updateCase('spectre', { published: true });

      expect(txCaseUpdate).toHaveBeenCalledWith({ published: true });
    });

    it('adds English and publishes in the same request', async () => {
      txFind.mockResolvedValue(russianOnlyDraft());

      const view = await service.updateCase('spectre', {
        published: true,
        translations: { en: englishText() },
      });

      expect(txTranslationCreate).toHaveBeenCalledTimes(1);
      expect(txCaseUpdate).toHaveBeenCalledWith({ published: true });
      expect(view.published).toBe(true);
      expect(view.translations.en).toEqual(englishText());
    });

    it('keeps a published case with both languages published when its Russian text changes', async () => {
      txFind.mockResolvedValue(bothLanguagesPublished());

      const view = await service.updateCase('spectre', {
        translations: { ru: { name: 'Новое имя' } },
      });

      expect(txCaseUpdate).not.toHaveBeenCalled();
      expect(view.published).toBe(true);
    });

    it('allows unpublishing a case that has only Russian', async () => {
      txFind.mockResolvedValue(
        caseWithTranslations({ published: true }, [
          translationRow({ locale: 'ru' }),
        ]),
      );

      await expect(
        service.updateCase('spectre', { published: false }),
      ).resolves.toMatchObject({ published: false });
    });

    it('returns the full view with the public picture URL', async () => {
      txFind.mockResolvedValue(
        caseWithTranslations({ imageKey: 'cases/spectre/ab12.webp' }),
      );

      const view = await service.updateCase('spectre', {
        translations: { en: { name: 'New name' } },
      });

      expect(view.image).toBe('https://cdn.test/cases/spectre/ab12.webp');
      expect(view).not.toHaveProperty('locale');
    });

    it('lets a database error propagate unchanged', async () => {
      const error = new Error('database error');
      txCaseUpdate.mockRejectedValue(error);

      await expect(
        service.updateCase('spectre', { company: 'Acme' }),
      ).rejects.toBe(error);
    });

    it('treats a translation that vanished during the update as not found', async () => {
      txFind.mockResolvedValue(bothLanguagesPublished());
      txTranslationUpdate.mockResolvedValue(null);

      await expect(
        service.updateCase('spectre', {
          translations: { en: { name: 'x' } },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setImage', () => {
    const IMAGE = Buffer.from('optimized webp bytes');
    const BLUR = 'data:image/webp;base64,AAAA';
    const NEW_KEY = `cases/spectre/${createHash('sha256').update(IMAGE).digest('hex').slice(0, 16)}.webp`;
    const OLD_KEY = 'cases/spectre/0000000000000000.webp';
    const upload = Buffer.from('uploaded file');

    beforeEach(() => {
      processImage.mockResolvedValue({ image: IMAGE, blur: BLUR });
      first.mockResolvedValue(caseRow({ imageKey: null }));
      update.mockImplementation((data) =>
        Promise.resolve(caseRow(data as Partial<CaseRow>)),
      );
      translationsAll.mockResolvedValue([
        translationRow({ locale: 'ru' }),
        translationRow({ locale: 'en', ...caseText({ name: 'Spectre' }) }),
      ]);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    it('throws NotFoundException for an unknown case and does no work', async () => {
      first.mockResolvedValue(null);

      await expect(service.setImage('nope', upload)).rejects.toThrow(
        NotFoundException,
      );

      expect(processImage).not.toHaveBeenCalled();
      expect(storagePut).not.toHaveBeenCalled();
    });

    it('looks the case up by slug, drafts included', async () => {
      await service.setImage('spectre', upload);

      expect(first).toHaveBeenCalledWith({ slug: 'spectre' });
    });

    it('uploads the optimized bytes under a content-hash key as image/webp', async () => {
      await service.setImage('spectre', upload);

      expect(processImage).toHaveBeenCalledWith(upload);
      expect(storagePut).toHaveBeenCalledWith(NEW_KEY, IMAGE, 'image/webp');
    });

    it('saves the key and the placeholder, and returns the picture URL', async () => {
      const view = await service.setImage('spectre', upload);

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
      expect(update).toHaveBeenCalledWith({
        imageKey: NEW_KEY,
        blurImage: BLUR,
      });
      expect(view.image).toBe(publicUrl(NEW_KEY));
      expect(view.blurImage).toBe(BLUR);
    });

    it('returns the full view with the translations of the case', async () => {
      const view = await service.setImage('spectre', upload);

      expect(translationsWhere).toHaveBeenCalledWith({ caseSlug: 'spectre' });
      expect(view.translations.ru).toMatchObject({ name: 'Спектр' });
      expect(view.translations.en).toMatchObject({ name: 'Spectre' });
    });

    it('reports a language without a translation as null', async () => {
      translationsAll.mockResolvedValue([translationRow({ locale: 'ru' })]);

      const view = await service.setImage('spectre', upload);

      expect(view.translations.en).toBeNull();
    });

    it('gives the same key to the same picture and another key to another', async () => {
      await service.setImage('spectre', upload);
      processImage.mockResolvedValue({
        image: Buffer.from('a different picture'),
        blur: BLUR,
      });
      await service.setImage('spectre', upload);

      const keys = storagePut.mock.calls.map(([key]) => key);
      expect(keys[0]).toBe(NEW_KEY);
      expect(keys[1]).not.toBe(NEW_KEY);
    });

    it('does not delete anything for the first picture of a case', async () => {
      await service.setImage('spectre', upload);

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('deletes the previous object after the new one is saved', async () => {
      first.mockResolvedValue(caseRow({ imageKey: OLD_KEY }));

      await service.setImage('spectre', upload);

      expect(storageDelete).toHaveBeenCalledTimes(1);
      expect(storageDelete).toHaveBeenCalledWith(OLD_KEY);
      const savedAt = update.mock.invocationCallOrder[0] ?? Infinity;
      const deletedAt = storageDelete.mock.invocationCallOrder[0] ?? 0;
      expect(deletedAt).toBeGreaterThan(savedAt);
    });

    it('keeps the object when the same picture is uploaded again', async () => {
      first.mockResolvedValue(caseRow({ imageKey: NEW_KEY }));

      await service.setImage('spectre', upload);

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('rethrows a rejected file and neither uploads nor saves anything', async () => {
      const rejection = new BadRequestException('not an image');
      processImage.mockRejectedValue(rejection);

      await expect(service.setImage('spectre', upload)).rejects.toBe(rejection);

      expect(storagePut).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('leaves the case untouched when the storage fails', async () => {
      const error = new Error('S3 is down');
      storagePut.mockRejectedValue(error);
      first.mockResolvedValue(caseRow({ imageKey: OLD_KEY }));

      await expect(service.setImage('spectre', upload)).rejects.toBe(error);

      expect(update).not.toHaveBeenCalled();
      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('removes the new object when saving the case fails', async () => {
      const error = new Error('database error');
      update.mockRejectedValue(error);
      first.mockResolvedValue(caseRow({ imageKey: OLD_KEY }));

      await expect(service.setImage('spectre', upload)).rejects.toBe(error);

      expect(storageDelete).toHaveBeenCalledTimes(1);
      expect(storageDelete).toHaveBeenCalledWith(NEW_KEY);
    });

    it('does not remove the object the case already uses when saving fails', async () => {
      update.mockRejectedValue(new Error('database error'));
      first.mockResolvedValue(caseRow({ imageKey: NEW_KEY }));

      await expect(service.setImage('spectre', upload)).rejects.toThrow(
        'database error',
      );

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('treats a case that vanished during the upload as not found and cleans up', async () => {
      update.mockResolvedValue(null);

      await expect(service.setImage('spectre', upload)).rejects.toThrow(
        NotFoundException,
      );

      expect(storageDelete).toHaveBeenCalledWith(NEW_KEY);
    });

    it('still succeeds when the previous object cannot be deleted', async () => {
      first.mockResolvedValue(caseRow({ imageKey: OLD_KEY }));
      storageDelete.mockRejectedValue(new Error('S3 is down'));

      await expect(service.setImage('spectre', upload)).resolves.toMatchObject({
        image: publicUrl(NEW_KEY),
      });
    });
  });

  describe('setBackground', () => {
    const IMAGE = Buffer.from('optimized background bytes');
    const BLUR = 'data:image/webp;base64,BBBB';
    const NEW_KEY = `cases/spectre/background/${createHash('sha256').update(IMAGE).digest('hex').slice(0, 16)}.webp`;
    const OLD_KEY = 'cases/spectre/background/0000000000000000.webp';
    const PICTURE_KEY = 'cases/spectre/1111111111111111.webp';
    const upload = Buffer.from('uploaded file');

    beforeEach(() => {
      processImage.mockResolvedValue({ image: IMAGE, blur: BLUR });
      first.mockResolvedValue(caseRow());
      update.mockImplementation((data) =>
        Promise.resolve(caseRow(data as Partial<CaseRow>)),
      );
      translationsAll.mockResolvedValue([
        translationRow({ locale: 'ru' }),
        translationRow({ locale: 'en', ...caseText({ name: 'Spectre' }) }),
      ]);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    it('throws NotFoundException for an unknown case and does no work', async () => {
      first.mockResolvedValue(null);

      await expect(service.setBackground('nope', upload)).rejects.toThrow(
        NotFoundException,
      );

      expect(processImage).not.toHaveBeenCalled();
      expect(storagePut).not.toHaveBeenCalled();
    });

    it('uploads the optimized bytes under the background folder as image/webp', async () => {
      await service.setBackground('spectre', upload);

      expect(processImage).toHaveBeenCalledWith(upload);
      expect(storagePut).toHaveBeenCalledWith(NEW_KEY, IMAGE, 'image/webp');
    });

    it('saves only the background columns and returns the background URL', async () => {
      const view = await service.setBackground('spectre', upload);

      expect(update).toHaveBeenCalledWith({
        backgroundImageKey: NEW_KEY,
        backgroundBlurImage: BLUR,
      });
      expect(view.backgroundImage).toBe(publicUrl(NEW_KEY));
      expect(view.backgroundBlurImage).toBe(BLUR);
    });

    it('leaves the case picture as it was', async () => {
      const withPicture = { imageKey: PICTURE_KEY, blurImage: 'data:x' };
      first.mockResolvedValue(caseRow(withPicture));
      // the database returns the whole row, not only the changed columns
      update.mockImplementation((data) =>
        Promise.resolve(
          caseRow({ ...withPicture, ...(data as Partial<CaseRow>) }),
        ),
      );

      const view = await service.setBackground('spectre', upload);

      expect(Object.keys(update.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
        'backgroundBlurImage',
        'backgroundImageKey',
      ]);
      expect(view.image).toBe(publicUrl(PICTURE_KEY));
      expect(storageDelete).not.toHaveBeenCalledWith(PICTURE_KEY);
    });

    it('returns the full view with the translations of the case', async () => {
      const view = await service.setBackground('spectre', upload);

      expect(view.translations.ru).toMatchObject({ name: 'Спектр' });
      expect(view.translations.en).toMatchObject({ name: 'Spectre' });
    });

    it('returns a null background URL when the row has none', async () => {
      update.mockResolvedValue(caseRow());

      const view = await service.setBackground('spectre', upload);

      expect(view.backgroundImage).toBeNull();
    });

    it('deletes the previous background after the new one is saved', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: OLD_KEY }));

      await service.setBackground('spectre', upload);

      expect(storageDelete).toHaveBeenCalledTimes(1);
      expect(storageDelete).toHaveBeenCalledWith(OLD_KEY);
      const savedAt = update.mock.invocationCallOrder[0] ?? Infinity;
      const deletedAt = storageDelete.mock.invocationCallOrder[0] ?? 0;
      expect(deletedAt).toBeGreaterThan(savedAt);
    });

    it('keeps the object when the same background is uploaded again', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: NEW_KEY }));

      await service.setBackground('spectre', upload);

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('rethrows a rejected file and neither uploads nor saves anything', async () => {
      const rejection = new BadRequestException('not an image');
      processImage.mockRejectedValue(rejection);

      await expect(service.setBackground('spectre', upload)).rejects.toBe(
        rejection,
      );

      expect(storagePut).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('leaves the case untouched when the storage fails', async () => {
      const error = new Error('S3 is down');
      storagePut.mockRejectedValue(error);
      first.mockResolvedValue(caseRow({ backgroundImageKey: OLD_KEY }));

      await expect(service.setBackground('spectre', upload)).rejects.toBe(
        error,
      );

      expect(update).not.toHaveBeenCalled();
      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('removes the new object when saving the case fails', async () => {
      const error = new Error('database error');
      update.mockRejectedValue(error);
      first.mockResolvedValue(caseRow({ backgroundImageKey: OLD_KEY }));

      await expect(service.setBackground('spectre', upload)).rejects.toBe(
        error,
      );

      expect(storageDelete).toHaveBeenCalledTimes(1);
      expect(storageDelete).toHaveBeenCalledWith(NEW_KEY);
    });

    it('does not remove the object the case already uses when saving fails', async () => {
      update.mockRejectedValue(new Error('database error'));
      first.mockResolvedValue(caseRow({ backgroundImageKey: NEW_KEY }));

      await expect(service.setBackground('spectre', upload)).rejects.toThrow(
        'database error',
      );

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('treats a case that vanished during the upload as not found and cleans up', async () => {
      update.mockResolvedValue(null);

      await expect(service.setBackground('spectre', upload)).rejects.toThrow(
        NotFoundException,
      );

      expect(storageDelete).toHaveBeenCalledWith(NEW_KEY);
    });

    it('still succeeds when the previous background cannot be deleted', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: OLD_KEY }));
      storageDelete.mockRejectedValue(new Error('S3 is down'));

      await expect(
        service.setBackground('spectre', upload),
      ).resolves.toMatchObject({ backgroundImage: publicUrl(NEW_KEY) });
    });
  });

  describe('removeBackground', () => {
    const KEY = 'cases/spectre/background/ab12.webp';

    beforeEach(() => {
      update.mockImplementation((data) =>
        Promise.resolve(caseRow(data as Partial<CaseRow>)),
      );
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    it('throws NotFoundException for an unknown case', async () => {
      first.mockResolvedValue(null);

      await expect(service.removeBackground('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clears only the background columns and deletes the stored object', async () => {
      first.mockResolvedValue(
        caseRow({
          imageKey: 'cases/spectre/picture.webp',
          backgroundImageKey: KEY,
          backgroundBlurImage: 'data:x',
        }),
      );

      await expect(
        service.removeBackground('spectre'),
      ).resolves.toBeUndefined();

      expect(update).toHaveBeenCalledWith({
        backgroundImageKey: null,
        backgroundBlurImage: null,
      });
      expect(storageDelete).toHaveBeenCalledTimes(1);
      expect(storageDelete).toHaveBeenCalledWith(KEY);
    });

    it('deletes the object only after the row is saved', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: KEY }));

      await service.removeBackground('spectre');

      const savedAt = update.mock.invocationCallOrder[0] ?? Infinity;
      const deletedAt = storageDelete.mock.invocationCallOrder[0] ?? 0;
      expect(deletedAt).toBeGreaterThan(savedAt);
    });

    it('is idempotent for a case without a background', async () => {
      first.mockResolvedValue(caseRow());

      await expect(
        service.removeBackground('spectre'),
      ).resolves.toBeUndefined();

      expect(update).not.toHaveBeenCalled();
      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('still succeeds when the object cannot be deleted', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: KEY }));
      storageDelete.mockRejectedValue(new Error('S3 is down'));

      await expect(
        service.removeBackground('spectre'),
      ).resolves.toBeUndefined();
    });

    it('keeps the object when saving the case fails', async () => {
      first.mockResolvedValue(caseRow({ backgroundImageKey: KEY }));
      const error = new Error('database error');
      update.mockRejectedValue(error);

      await expect(service.removeBackground('spectre')).rejects.toBe(error);

      expect(storageDelete).not.toHaveBeenCalled();
    });
  });

  describe('removeImage', () => {
    const KEY = 'cases/spectre/ab12.webp';

    beforeEach(() => {
      update.mockImplementation((data) =>
        Promise.resolve(caseRow(data as Partial<CaseRow>)),
      );
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    it('throws NotFoundException for an unknown case', async () => {
      first.mockResolvedValue(null);

      await expect(service.removeImage('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clears both picture columns and deletes the stored object', async () => {
      first.mockResolvedValue(caseRow({ imageKey: KEY, blurImage: 'data:x' }));

      await expect(service.removeImage('spectre')).resolves.toBeUndefined();

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
      expect(update).toHaveBeenCalledWith({ imageKey: null, blurImage: null });
      expect(storageDelete).toHaveBeenCalledWith(KEY);
    });

    it('deletes the object only after the row is saved', async () => {
      first.mockResolvedValue(caseRow({ imageKey: KEY }));

      await service.removeImage('spectre');

      const savedAt = update.mock.invocationCallOrder[0] ?? Infinity;
      const deletedAt = storageDelete.mock.invocationCallOrder[0] ?? 0;
      expect(deletedAt).toBeGreaterThan(savedAt);
    });

    it('is idempotent for a case without a picture', async () => {
      first.mockResolvedValue(caseRow({ imageKey: null, blurImage: null }));

      await expect(service.removeImage('spectre')).resolves.toBeUndefined();

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('still succeeds when the object cannot be deleted', async () => {
      first.mockResolvedValue(caseRow({ imageKey: KEY }));
      storageDelete.mockRejectedValue(new Error('S3 is down'));

      await expect(service.removeImage('spectre')).resolves.toBeUndefined();
    });

    it('keeps the object when saving the case fails', async () => {
      first.mockResolvedValue(caseRow({ imageKey: KEY }));
      const error = new Error('database error');
      update.mockRejectedValue(error);

      await expect(service.removeImage('spectre')).rejects.toBe(error);

      expect(storageDelete).not.toHaveBeenCalled();
    });
  });

  describe('deleteCase', () => {
    it('deletes by slug', async () => {
      remove.mockResolvedValue(caseRow());

      await expect(service.deleteCase('spectre')).resolves.toBeUndefined();

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
    });

    it('leaves the translations to the cascade of the database', async () => {
      remove.mockResolvedValue(caseRow());

      await service.deleteCase('spectre');

      expect(translationsWhere).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('deletes the stored picture of the removed case', async () => {
      remove.mockResolvedValue(
        caseRow({ imageKey: 'cases/spectre/ab12.webp' }),
      );

      await service.deleteCase('spectre');

      expect(storageDelete).toHaveBeenCalledWith('cases/spectre/ab12.webp');
    });

    it('deletes the stored background of the removed case too', async () => {
      remove.mockResolvedValue(
        caseRow({
          imageKey: 'cases/spectre/ab12.webp',
          backgroundImageKey: 'cases/spectre/background/cd34.webp',
        }),
      );

      await service.deleteCase('spectre');

      expect(storageDelete).toHaveBeenCalledTimes(2);
      expect(storageDelete).toHaveBeenCalledWith('cases/spectre/ab12.webp');
      expect(storageDelete).toHaveBeenCalledWith(
        'cases/spectre/background/cd34.webp',
      );
    });

    it('deletes the background even when the case has no picture', async () => {
      remove.mockResolvedValue(
        caseRow({ backgroundImageKey: 'cases/spectre/background/cd34.webp' }),
      );

      await service.deleteCase('spectre');

      expect(storageDelete).toHaveBeenCalledWith(
        'cases/spectre/background/cd34.webp',
      );
    });

    it('still removes the background when the picture cannot be deleted', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      remove.mockResolvedValue(
        caseRow({
          imageKey: 'cases/spectre/ab12.webp',
          backgroundImageKey: 'cases/spectre/background/cd34.webp',
        }),
      );
      storageDelete.mockRejectedValueOnce(new Error('S3 is down'));

      await expect(service.deleteCase('spectre')).resolves.toBeUndefined();

      expect(storageDelete).toHaveBeenCalledWith(
        'cases/spectre/background/cd34.webp',
      );
    });

    it('touches no storage for a case without a picture', async () => {
      remove.mockResolvedValue(caseRow({ imageKey: null }));

      await service.deleteCase('spectre');

      expect(storageDelete).not.toHaveBeenCalled();
    });

    it('still succeeds when the stored picture cannot be deleted', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      remove.mockResolvedValue(
        caseRow({ imageKey: 'cases/spectre/ab12.webp' }),
      );
      storageDelete.mockRejectedValue(new Error('S3 is down'));

      await expect(service.deleteCase('spectre')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the case does not exist', async () => {
      remove.mockResolvedValue(null);

      await expect(service.deleteCase('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
