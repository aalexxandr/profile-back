import type {
  CaseFullView,
  CaseRow,
  CaseText,
  CaseTranslationRow,
  CaseView,
  CaseWithTranslations,
} from './case.types';

/** A full database row of a case; each test overrides only what it checks. */
export const caseRow = (overrides: Partial<CaseRow> = {}): CaseRow => ({
  slug: 'spectre',
  projectLink: 'https://thespectre.io',
  stack: ['React', 'TypeScript'],
  imageKey: null,
  blurImage: null,
  role: 'FRONTEND',
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

/** The text of a case in one language (English by default, easy to tell from `ru`). */
export const caseText = (overrides: Partial<CaseText> = {}): CaseText => ({
  name: 'The Spectre Explorer',
  category: 'FinTech / Web App',
  shortDescription: 'Blockchain explorer',
  description: 'Long description',
  achievements: [
    { title: 'Faster', description: 'Less manual work', metric: '-30%' },
  ],
  ...overrides,
});

/** A database row of `case_translations`. */
export const translationRow = (
  overrides: Partial<CaseTranslationRow> = {},
): CaseTranslationRow => ({
  caseSlug: 'spectre',
  locale: 'ru',
  ...caseText({
    name: 'Спектр',
    category: 'Финтех / Веб-приложение',
    shortDescription: 'Обозреватель блокчейна',
    description: 'Длинное описание',
    achievements: [
      { title: 'Быстрее', description: 'Меньше ручной работы', metric: '-30%' },
    ],
  }),
  ...overrides,
});

/** A case row with both translations loaded, as `.include('translations')` returns it. */
export const caseWithTranslations = (
  overrides: Partial<CaseRow> = {},
  translations: CaseTranslationRow[] = [
    translationRow({ locale: 'ru' }),
    translationRow({ locale: 'en', ...caseText({ name: 'Spectre' }) }),
  ],
): CaseWithTranslations => ({ ...caseRow(overrides), translations });

/** A row as the public reads return it: flat text, `locale` and the computed `image` URL. */
export const caseView = (overrides: Partial<CaseView> = {}): CaseView => ({
  ...caseRow(),
  ...caseText(),
  image: null,
  locale: 'ru',
  ...overrides,
});

/** A row as the writes return it: every language and the computed `image` URL. */
export const caseAdminView = (
  overrides: Partial<CaseFullView> = {},
): CaseFullView => ({
  ...caseRow(),
  image: null,
  translations: { ru: caseText(), en: caseText({ name: 'Spectre' }) },
  ...overrides,
});
