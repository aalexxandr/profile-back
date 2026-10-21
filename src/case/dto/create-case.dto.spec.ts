import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCaseDto } from './create-case.dto';

const translation = (overrides: Record<string, unknown> = {}) => ({
  name: 'The Spectre Explorer',
  category: 'FinTech / Web App',
  shortDescription: 'Blockchain explorer',
  description: 'Long description',
  achievements: [
    { title: 'Faster', description: 'Less manual work', metric: '-30%' },
  ],
  ...overrides,
});

// valid-object factory: each test changes one field
const validCase = (overrides: Record<string, unknown> = {}) => ({
  slug: 'spectre',
  projectLink: 'https://thespectre.io',
  stack: ['React', 'TypeScript'],
  role: 'FRONTEND',
  startedAt: '2024-01-01',
  translations: { ru: translation() },
  ...overrides,
});

const errorsFor = (data: object) =>
  validate(plainToInstance(CreateCaseDto, data), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const achievements = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    title: `title ${i}`,
    description: 'description',
    metric: 'metric',
  }));

describe('CreateCaseDto', () => {
  describe('accepts', () => {
    it.each([
      ['required fields only', {}],
      [
        'all optional fields',
        {
          company: 'Acme',
          teamSize: 5,
          endedAt: '2024-06-01',
          sortOrder: 3,
          published: true,
          translations: { ru: translation(), en: translation() },
        },
      ],
      ['slug of 50 characters', { slug: 'a'.repeat(50) }],
      [
        '30 stack entries',
        { stack: Array.from({ length: 30 }, (_, i) => `t${i}`) },
      ],
      ['teamSize of 1', { teamSize: 1 }],
      ['endedAt equal to startedAt', { endedAt: '2024-01-01' }],
      [
        'a complete English translation next to the Russian one',
        { translations: { ru: translation(), en: translation() } },
      ],
      [
        '10 achievements in a translation',
        {
          translations: { ru: translation({ achievements: achievements(10) }) },
        },
      ],
      [
        'no achievements in a translation',
        { translations: { ru: translation({ achievements: [] }) } },
      ],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).toHaveLength(0);
    });
  });

  describe('rejects', () => {
    it.each([
      ['slug with uppercase and symbols', { slug: 'My Case!' }],
      ['slug in uppercase', { slug: 'SPECTRE' }],
      ['slug with leading hyphen', { slug: '-spectre' }],
      ['empty slug', { slug: '' }],
      ['slug of 51 characters', { slug: 'a'.repeat(51) }],
      ['non-http link', { projectLink: 'ftp://example.com' }],
      ['unknown field', { foo: 1 }],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });

    it.each([
      ['empty stack', { stack: [] }],
      ['duplicate stack entries', { stack: ['React', 'React'] }],
      [
        '31 stack entries',
        { stack: Array.from({ length: 31 }, (_, i) => `t${i}`) },
      ],
      ['teamSize of 0', { teamSize: 0 }],
      ['fractional teamSize', { teamSize: 1.5 }],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });

    it.each([
      ['missing startedAt', { startedAt: undefined }],
      ['startedAt that is not a date', { startedAt: 'yesterday' }],
      ['startedAt with a time part', { startedAt: '2024-01-01T10:00:00Z' }],
      ['impossible startedAt', { startedAt: '2024-02-30' }],
      [
        'endedAt earlier than startedAt',
        { startedAt: '2024-05-01', endedAt: '2024-01-01' },
      ],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });

    it.each([
      ['missing translations', { translations: undefined }],
      ['empty translations', { translations: {} }],
      ['translations without Russian', { translations: { en: translation() } }],
      ['translations that is not an object', { translations: 'ru' }],
      [
        'unknown locale next to a valid Russian translation',
        { translations: { ru: translation(), de: translation() } },
      ],
      [
        'old flat text fields at the top level',
        { name: 'Old', description: 'Old', category: 'Old' },
      ],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });

    it.each([
      ['Russian name of 101 characters', 'ru', { name: 'a'.repeat(101) }],
      ['Russian empty name', 'ru', { name: '' }],
      ['Russian category of 51 characters', 'ru', { category: 'a'.repeat(51) }],
      [
        'Russian shortDescription of 501 characters',
        'ru',
        { shortDescription: 'a'.repeat(501) },
      ],
      [
        'Russian description of 2001 characters',
        'ru',
        { description: 'a'.repeat(2001) },
      ],
      [
        'Russian translation without description',
        'ru',
        { description: undefined },
      ],
      [
        'Russian translation without achievements',
        'ru',
        { achievements: undefined },
      ],
      ['Russian translation with an unknown field', 'ru', { foo: 1 }],
      ['English name of 101 characters', 'en', { name: 'a'.repeat(101) }],
      [
        'English translation without description',
        'en',
        { description: undefined },
      ],
    ])('%s', async (_name, locale, overrides) => {
      const translations: Record<string, unknown> = { ru: translation() };
      if (locale === 'en') translations['en'] = translation(overrides);
      else translations['ru'] = translation(overrides);
      expect(await errorsFor(validCase({ translations }))).not.toHaveLength(0);
    });

    it.each([
      [
        'achievement without a metric',
        { achievements: [{ title: 'a', description: 'b' }] },
      ],
      [
        'achievement with an empty title',
        { achievements: [{ title: '', description: 'b', metric: 'c' }] },
      ],
      ['plain string achievement', { achievements: ['old shape'] }],
      ['11 achievements', { achievements: achievements(11) }],
    ])('%s (in a translation)', async (_name, overrides) => {
      expect(
        await errorsFor(
          validCase({ translations: { ru: translation(overrides) } }),
        ),
      ).not.toHaveLength(0);
    });
  });
});
