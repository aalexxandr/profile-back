import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateCaseDto } from './update-case.dto';

const errorsFor = (data: object) =>
  validate(plainToInstance(UpdateCaseDto, data), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateCaseDto', () => {
  it.each([
    ['empty body', {}],
    ['only published', { published: true }],
    ['only teamSize', { teamSize: 3 }],
    ['empty translations', { translations: {} }],
    ['only a Russian name', { translations: { ru: { name: 'New name' } } }],
    ['only an English name', { translations: { en: { name: 'New name' } } }],
    [
      'both languages, some fields',
      {
        translations: {
          ru: { description: 'Описание' },
          en: { shortDescription: 'Short' },
        },
      },
    ],
    [
      'achievements of one language',
      {
        translations: {
          en: {
            achievements: [{ title: 'a', description: 'b', metric: 'c' }],
          },
        },
      },
    ],
    [
      'a language-independent field and a translation',
      { company: 'Acme', translations: { ru: { category: 'Web' } } },
    ],
  ])('accepts a partial body: %s', async (_name, data) => {
    expect(await errorsFor(data)).toHaveLength(0);
  });

  it.each([
    ['slug in the body', { slug: 'other' }],
    ['unknown field', { foo: 1 }],
    ['old flat name at the top level', { name: 'Old' }],
    ['teamSize of 0', { teamSize: 0 }],
    ['malformed startedAt', { startedAt: 'yesterday' }],
    [
      'endedAt earlier than startedAt',
      { startedAt: '2024-05-01', endedAt: '2024-01-01' },
    ],
    ['unknown locale', { translations: { de: { name: 'x' } } }],
    ['unknown field in a translation', { translations: { ru: { foo: 'x' } } }],
    [
      'name of 101 characters in a translation',
      { translations: { en: { name: 'a'.repeat(101) } } },
    ],
    ['empty name in a translation', { translations: { ru: { name: '' } } }],
    [
      'achievement without a metric in a translation',
      {
        translations: {
          ru: { achievements: [{ title: 'a', description: 'b' }] },
        },
      },
    ],
  ])('rejects: %s', async (_name, data) => {
    expect(await errorsFor(data)).not.toHaveLength(0);
  });
});
