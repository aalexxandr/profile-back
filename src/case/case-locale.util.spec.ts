import { resolveLocale } from './case-locale.util';

describe('resolveLocale', () => {
  it('returns en for the exact string en', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  it('returns ru for the string ru', () => {
    expect(resolveLocale('ru')).toBe('ru');
  });

  it.each([
    ['a missing value', undefined],
    ['an empty string', ''],
    ['an unsupported language', 'de'],
    ['a different case', 'EN'],
    ['a value with a region', 'en-US'],
    ['an array (repeated query parameter)', ['en', 'ru']],
    ['an object', { lang: 'en' }],
    ['a number', 1],
  ])('falls back to ru for %s', (_name, raw) => {
    expect(resolveLocale(raw)).toBe('ru');
  });
});
