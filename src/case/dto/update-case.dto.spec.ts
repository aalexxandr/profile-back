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
    ['only name', { name: 'New name' }],
    ['only published', { published: true }],
    ['only teamSize', { teamSize: 3 }],
    [
      'achievements',
      { achievements: [{ title: 'a', description: 'b', metric: 'c' }] },
    ],
  ])('accepts a partial body: %s', async (_name, data) => {
    expect(await errorsFor(data)).toHaveLength(0);
  });

  it.each([
    ['slug in the body', { slug: 'other' }],
    ['unknown field', { foo: 1 }],
    ['name that is too long', { name: 'a'.repeat(101) }],
    ['teamSize of 0', { teamSize: 0 }],
    ['malformed startedAt', { startedAt: 'yesterday' }],
    [
      'endedAt earlier than startedAt',
      { startedAt: '2024-05-01', endedAt: '2024-01-01' },
    ],
    [
      'achievement without a metric',
      { achievements: [{ title: 'a', description: 'b' }] },
    ],
  ])('rejects: %s', async (_name, data) => {
    expect(await errorsFor(data)).not.toHaveLength(0);
  });
});
