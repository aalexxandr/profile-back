import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCaseDto } from './create-case.dto';

// valid-object factory: each test changes one field
const validCase = (overrides: Record<string, unknown> = {}) => ({
  slug: 'spectre',
  name: 'The Spectre Explorer',
  projectLink: 'https://thespectre.io',
  category: 'FinTech / Web App',
  stack: ['React', 'TypeScript'],
  shortDescription: 'Blockchain explorer',
  description: 'Long description',
  role: 'FRONTEND',
  achievements: [
    { title: 'Faster', description: 'Less manual work', metric: '-30%' },
  ],
  startedAt: '2024-01-01',
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
        },
      ],
      ['slug of 50 characters', { slug: 'a'.repeat(50) }],
      ['teamSize of 1', { teamSize: 1 }],
      ['endedAt equal to startedAt', { endedAt: '2024-01-01' }],
      ['10 achievements', { achievements: achievements(10) }],
      ['no achievements', { achievements: [] }],
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
      ['name of 101 characters', { name: 'a'.repeat(101) }],
      ['non-http link', { projectLink: 'ftp://example.com' }],
      ['unknown field', { foo: 1 }],
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });

    it.each([
      ['empty stack', { stack: [] }],
      ['duplicate stack entries', { stack: ['React', 'React'] }],
      [
        '11 stack entries',
        { stack: Array.from({ length: 11 }, (_, i) => `t${i}`) },
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
    ])('%s', async (_name, overrides) => {
      expect(await errorsFor(validCase(overrides))).not.toHaveLength(0);
    });
  });
});
