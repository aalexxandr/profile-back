import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
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
  let service: CaseService;

  beforeEach(async () => {
    jest.resetAllMocks();
    where.mockImplementation(() => ({ orderBy }));
    orderBy.mockImplementation(() => ({ all }));
    whereUnique.mockImplementation(() => ({ update, delete: remove }));
    const moduleRef = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: PrismaService,
          useValue: { cases: { first, create, where, whereUnique } },
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

      await expect(service.findAll()).resolves.toEqual(rows);
    });

    it('returns an empty list when nothing is published', async () => {
      all.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('findBySlug', () => {
    it('returns the published case', async () => {
      const row = caseRow({ slug: 'spectre' });
      first.mockResolvedValue(row);

      await expect(service.findBySlug('spectre')).resolves.toBe(row);
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

      await expect(service.createCase(createDto())).resolves.toBe(row);
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
      expect(result).toBe(row);
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
  });

  describe('deleteCase', () => {
    it('deletes by slug', async () => {
      remove.mockResolvedValue(caseRow());

      await expect(service.deleteCase('spectre')).resolves.toBeUndefined();

      expect(whereUnique).toHaveBeenCalledWith({ slug: 'spectre' });
    });

    it('throws NotFoundException when the case does not exist', async () => {
      remove.mockResolvedValue(null);

      await expect(service.deleteCase('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
