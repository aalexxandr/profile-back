import { assertSafeDatabase } from './assert-safe-database';
import { uniqueId } from './unique-id';

// Тесты самих помощников; БД не нужна.
describe('assertSafeDatabase', () => {
  it.each([
    ['localhost', 'postgresql://u:p@localhost:5434/db'],
    ['127.0.0.1', 'postgresql://u:p@127.0.0.1:5432/db'],
    ['IPv6 loopback', 'postgresql://u:p@[::1]:5432/db'],
  ])('пропускает %s', (_name, uri) => {
    expect(() => assertSafeDatabase(uri)).not.toThrow();
  });

  it('пропускает пустое значение (тест без БД)', () => {
    expect(() => assertSafeDatabase(undefined)).not.toThrow();
    expect(() => assertSafeDatabase('')).not.toThrow();
  });

  it('отклоняет внешний хост', () => {
    expect(() =>
      assertSafeDatabase('postgresql://u:p@db.example.com:5432/db'),
    ).toThrow('db.example.com');
  });

  it('отклоняет строку, которую нельзя разобрать', () => {
    expect(() => assertSafeDatabase('not a url')).toThrow('не разобрать');
  });
});

describe('uniqueId', () => {
  it('даёт разные значения при каждом вызове', () => {
    expect(uniqueId()).not.toBe(uniqueId());
  });

  it('начинается с префикса и не длиннее maxLength', () => {
    const id = uniqueId('abc', 12);

    expect(id.startsWith('abc-')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(12);
  });
});
