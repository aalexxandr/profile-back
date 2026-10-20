import { caseText, translationRow } from './case.fixtures';
import {
  canBePublished,
  isCompleteText,
  omitUndefined,
  pickText,
  selectTranslation,
  textsByLocale,
  toTranslationMap,
} from './case-translation.util';

describe('pickText', () => {
  it('keeps exactly the five text fields of a translation row', () => {
    const row = translationRow({ locale: 'en' });

    expect(pickText(row)).toEqual({
      name: row.name,
      category: row.category,
      shortDescription: row.shortDescription,
      description: row.description,
      achievements: row.achievements,
    });
    expect(pickText(row)).not.toHaveProperty('caseSlug');
    expect(pickText(row)).not.toHaveProperty('locale');
  });
});

describe('isCompleteText', () => {
  it('accepts an object with all five fields', () => {
    expect(isCompleteText(caseText())).toBe(true);
  });

  it('accepts an empty achievements list', () => {
    expect(isCompleteText(caseText({ achievements: [] }))).toBe(true);
  });

  it.each([
    ['name', { name: undefined }],
    ['category', { category: undefined }],
    ['shortDescription', { shortDescription: undefined }],
    ['description', { description: undefined }],
    ['achievements', { achievements: undefined }],
  ])('rejects an object without %s', (_field, overrides) => {
    expect(isCompleteText({ ...caseText(), ...overrides })).toBe(false);
  });

  it('rejects an empty object', () => {
    expect(isCompleteText({})).toBe(false);
  });
});

describe('canBePublished', () => {
  it('requires both Russian and English', () => {
    expect(canBePublished(['ru', 'en'])).toBe(true);
    expect(canBePublished(['en', 'ru'])).toBe(true);
  });

  it.each([
    ['only Russian', ['ru']],
    ['only English', ['en']],
    ['nothing', []],
  ] as const)('is false with %s', (_name, locales) => {
    expect(canBePublished(locales)).toBe(false);
  });
});

describe('selectTranslation', () => {
  const ru = translationRow({ locale: 'ru' });
  const en = translationRow({ locale: 'en', name: 'Spectre' });

  it('returns the requested language when it exists', () => {
    expect(selectTranslation([ru, en], 'en')).toBe(en);
    expect(selectTranslation([en, ru], 'ru')).toBe(ru);
  });

  it('falls back to Russian when the requested language is missing', () => {
    expect(selectTranslation([ru], 'en')).toBe(ru);
  });

  it('returns undefined when there is nothing to serve', () => {
    expect(selectTranslation([], 'ru')).toBeUndefined();
    expect(selectTranslation([en], 'ru')).toBeUndefined();
  });
});

describe('textsByLocale', () => {
  it('indexes the text of each translation row by its language', () => {
    const texts = textsByLocale([
      translationRow({ locale: 'ru' }),
      translationRow({ locale: 'en', name: 'Spectre' }),
    ]);

    expect(texts.ru?.name).toBe('Спектр');
    expect(texts.en?.name).toBe('Spectre');
    expect(texts.en).not.toHaveProperty('locale');
  });

  it('leaves a missing language undefined', () => {
    expect(
      textsByLocale([translationRow({ locale: 'ru' })]).en,
    ).toBeUndefined();
  });
});

describe('toTranslationMap', () => {
  it('has both languages and uses null for a missing one', () => {
    const ru = caseText();

    expect(toTranslationMap({ ru })).toEqual({ ru, en: null });
    expect(toTranslationMap({})).toEqual({ ru: null, en: null });
  });
});

describe('omitUndefined', () => {
  it('drops undefined values and keeps null, false, 0 and empty strings', () => {
    expect(
      omitUndefined({
        a: undefined,
        b: null,
        c: false,
        d: 0,
        e: '',
        f: 'x',
      }),
    ).toEqual({ b: null, c: false, d: 0, e: '', f: 'x' });
  });

  it('does not add keys and does not change its input', () => {
    const input = { a: undefined, b: 1 };

    expect(Object.keys(omitUndefined(input))).toEqual(['b']);
    expect(Object.keys(input)).toEqual(['a', 'b']);
  });
});
