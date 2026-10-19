import type { CaseRow, CaseView } from './case.types';

/** A full database row of a case; each test overrides only what it checks. */
export const caseRow = (overrides: Partial<CaseRow> = {}): CaseRow => ({
  slug: 'spectre',
  name: 'The Spectre Explorer',
  projectLink: 'https://thespectre.io',
  category: 'FinTech / Web App',
  stack: ['React', 'TypeScript'],
  shortDescription: 'Blockchain explorer',
  description: 'Long description',
  imageKey: null,
  blurImage: null,
  role: 'FRONTEND',
  achievements: [
    { title: 'Faster', description: 'Less manual work', metric: '-30%' },
  ],
  company: 'Acme',
  teamSize: 5,
  startedAt: '2024-01-01',
  endedAt: '2024-06-01',
  sortOrder: 2,
  published: true,
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-03T00:00:00Z'),
  ...overrides,
});

/** A row as the service returns it: with the computed `image` URL. */
export const caseView = (overrides: Partial<CaseView> = {}): CaseView => ({
  ...caseRow(),
  image: null,
  ...overrides,
});
