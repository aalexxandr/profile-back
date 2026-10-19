import { createHash } from 'node:crypto';

import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { ProcessedImage } from '../image/image.types';
import { ImageProcessingService } from '../image/image-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { caseRow } from './case.fixtures';
import { CaseService } from './case.service';
import type { CaseRow } from './case.types';
import type { CreateCaseDto } from './dto/create-case.dto';

const createDto = (overrides: Partial<CreateCaseDto> = {}): CreateCaseDto => ({
  slug: 'spectre',
  name: 'The Spectre Explorer',
  projectLink: 'https://thespectre.io',
  category: 'FinTech / Web App',
  stack: ['React'],
  shortDescription: 'Blockchain explorer',
  description: 'Long description',
  role: 'FRONTEND',
  achievements: [{ title: 'a', description: 'b', metric: 'c' }],
  startedAt: '2024-01-01',
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
  const first = jest.fn<Promise<CaseRow | null>, [Record<string, unknown>]>();
  const create = jest.fn<Promise<CaseRow>, [Record<string, unknown>]>();
  const update = jest.fn<Promise<CaseRow | null>, [Record<string, unknown>]>();
  const remove = jest.fn<Promise<CaseRow | null>, []>();
  const all = jest.fn<Promise<CaseRow[]>, []>();
  type Order = (row: FakeRow) => unknown;
  const orderBy = jest.fn((_order: Order[]) => ({ all }));
  const where = jest.fn((_filter: Record<string, unknown>) => ({ orderBy }));
  const whereUnique = jest.fn((_criterion: { slug: string }) => ({
    update,
    delete: remove,
  }));
  const storagePublicUrl = jest.fn<string, [string]>();
  const storagePut = jest.fn<Promise<void>, [string, Buffer, string]>();
  const storageDelete = jest.fn<Promise<void>, [string]>();
  const processImage = jest.fn<Promise<ProcessedImage>, [Buffer]>();
  let service: CaseService;

  beforeEach(async () => {
    jest.resetAllMocks();
    where.mockImplementation(() => ({ orderBy }));
    orderBy.mockImplementation(() => ({ all }));
    whereUnique.mockImplementation(() => ({ update, delete: remove }));
    storagePublicUrl.mockImplementation(publicUrl);
    storagePut.mockResolvedValue();
    storageDelete.mockResolvedValue();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: PrismaService,
          useValue: { cases: { first, create, where, whereUnique } },
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
    it('lists only published cases, ordered by sortOrder then newest first', async () => {
      all.mockResolvedValue([]);

      await service.findAll();

      expect(where).toHaveBeenCalledWith({ published: true });
      const [order] = orderBy.mock.calls[0] ?? [];
      expect(order?.map((by) => by(fakeRow))).toEqual([
        'sortOrder asc',
        'createdAt desc',
      ]);
    });

    it('returns the published rows as they come from the database', async () => {
      const rows = [caseRow({ slug: 'a' }), caseRow({ slug: 'b' })];
      all.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toEqual(
        rows.map((row) => ({ ...row, image: null })),
      );
    });

    it('returns an empty list when nothing is published', async () => {
      all.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
    });

    it('adds the public picture URL to rows that have one and null to the rest', async () => {
      all.mockResolvedValue([
        caseRow({ slug: 'with', imageKey: 'cases/with/ab12.webp' }),
        caseRow({ slug: 'without', imageKey: null }),
      ]);

      const views = await service.findAll();

      expect(views.map((view) => view.image)).toEqual([
        'https://cdn.test/cases/with/ab12.webp',
        null,
      ]);
    });
  });

  describe('findBySlug', () => {
    it('returns the published case', async () => {
      const row = caseRow({ slug: 'spectre' });
      first.mockResolvedValue(row);

      await expect(service.findBySlug('spectre')).resolves.toEqual({
        ...row,
        image: null,
      });
    });

    it('asks only for published cases', async () => {
      first.mockResolvedValue(caseRow());

      await service.findBySlug('spectre');

      expect(first).toHaveBeenCalledWith({ slug: 'spectre', published: true });
    });

    it('throws NotFoundException when no published case matches', async () => {
      first.mockResolvedValue(null);

      await expect(service.findBySlug('draft-or-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('adds the public picture URL built from the stored key', async () => {
      first.mockResolvedValue(caseRow({ imageKey: 'cases/spectre/ab12.webp' }));

      const view = await service.findBySlug('spectre');

      expect(view.image).toBe('https://cdn.test/cases/spectre/ab12.webp');
      expect(storagePublicUrl).toHaveBeenCalledWith('cases/spectre/ab12.webp');
    });
  });

  describe('createCase', () => {
    it('defaults to an unpublished case without optional values', async () => {
      create.mockResolvedValue(caseRow({ published: false }));

      await service.createCase(createDto());

      expect(create).toHaveBeenCalledWith(
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
      create.mockResolvedValue(caseRow());

      await service.createCase(
        createDto({
          published: true,
          sortOrder: 3,
          company: 'Acme',
          teamSize: 5,
          endedAt: '2024-06-01',
        }),
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          published: true,
          sortOrder: 3,
          company: 'Acme',
          teamSize: 5,
          endedAt: '2024-06-01',
        }),
      );
    });

    it('returns the created row', async () => {
      const row = caseRow({ published: false });
      create.mockResolvedValue(row);

      await expect(service.createCase(createDto())).resolves.toEqual({
        ...row,
        image: null,
      });
    });

    it('does not set the picture columns: a new case has no picture', async () => {
      create.mockResolvedValue(caseRow());

      await service.createCase(createDto());

      const [data] = create.mock.calls[0] ?? [];
      expect(data).not.toHaveProperty('imageKey');
      expect(data).not.toHaveProperty('blurImage');
    });

    it('lets a database error propagate unchanged', async () => {
      const error = new Error('database error');
      create.mockRejectedValue(error);

      await expect(service.createCase(createDto())).rejects.toBe(error);
    });
  });

  describe('updateCase', () => {
    it('updates by slug with the given fields only', async () => {
      const row = caseRow({ name: 'New name' });
      update.mockResolvedValue(row);

      const result = await service.updateCase('spectre', { name: 'New name' });

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
      expect(update).toHaveBeenCalledWith({ name: 'New name' });
      expect(result).toEqual({ ...row, image: null });
    });

    it('updates an unpublished case too', async () => {
      update.mockResolvedValue(caseRow({ published: true }));

      await service.updateCase('draft', { published: true });

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'draft' });
    });

    it('throws NotFoundException when the case does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(
        service.updateCase('does-not-exist', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('keeps the public picture URL of the updated case', async () => {
      update.mockResolvedValue(
        caseRow({ imageKey: 'cases/spectre/ab12.webp', name: 'New name' }),
      );

      const view = await service.updateCase('spectre', { name: 'New name' });

      expect(view.image).toBe('https://cdn.test/cases/spectre/ab12.webp');
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

    it('deletes the stored picture of the removed case', async () => {
      remove.mockResolvedValue(
        caseRow({ imageKey: 'cases/spectre/ab12.webp' }),
      );

      await service.deleteCase('spectre');

      expect(storageDelete).toHaveBeenCalledWith('cases/spectre/ab12.webp');
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
