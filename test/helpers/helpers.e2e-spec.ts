import { assertSafeDatabase } from './assert-safe-database';
import { InMemoryStorage } from './in-memory-storage';
import { uniqueId } from './unique-id';

describe('InMemoryStorage', () => {
  it('stores an object with its content type and reports it', async () => {
    const storage = new InMemoryStorage();

    await storage.put('cases/a/b.webp', Buffer.from('x'), 'image/webp');

    expect(storage.has('cases/a/b.webp')).toBe(true);
    expect(storage.keys()).toEqual(['cases/a/b.webp']);
    expect(storage.get('cases/a/b.webp')?.contentType).toBe('image/webp');
  });

  it('removes an object, and removing a missing one is harmless', async () => {
    const storage = new InMemoryStorage();
    await storage.put('k', Buffer.alloc(1), 'image/webp');

    await storage.delete('k');
    await storage.delete('k');

    expect(storage.has('k')).toBe(false);
  });

  it('builds an absolute public URL like the real service', () => {
    expect(
      new InMemoryStorage('https://cdn.test').publicUrl('cases/a.webp'),
    ).toBe('https://cdn.test/cases/a.webp');
  });
});

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
