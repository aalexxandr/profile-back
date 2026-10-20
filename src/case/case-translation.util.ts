import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './case.constants';
import type { CaseText, CaseTranslationRow, Locale } from './case.types';

/** Copies the five text fields out of a translation row (or any object that has them). */
export function pickText(source: CaseText): CaseText {
  return {
    name: source.name,
    category: source.category,
    shortDescription: source.shortDescription,
    description: source.description,
    achievements: source.achievements,
  };
}

/** True when every text field is present, so the object can stand as a whole translation. */
export function isCompleteText(patch: Partial<CaseText>): patch is CaseText {
  return (
    patch.name !== undefined &&
    patch.category !== undefined &&
    patch.shortDescription !== undefined &&
    patch.description !== undefined &&
    patch.achievements !== undefined
  );
}

/** A case may be published only when it is translated into every supported language. */
export function canBePublished(locales: readonly Locale[]): boolean {
  return SUPPORTED_LOCALES.every((locale) => locales.includes(locale));
}

/** The requested translation, else the Russian one, else nothing. */
export function selectTranslation(
  translations: readonly CaseTranslationRow[],
  locale: Locale,
): CaseTranslationRow | undefined {
  return (
    translations.find((row) => row.locale === locale) ??
    translations.find((row) => row.locale === DEFAULT_LOCALE)
  );
}

/** Indexes the text of translation rows by their language. */
export function textsByLocale(
  translations: readonly CaseTranslationRow[],
): Partial<Record<Locale, CaseText>> {
  const texts: Partial<Record<Locale, CaseText>> = {};
  for (const row of translations) texts[row.locale] = pickText(row);
  return texts;
}

/** Both supported languages as keys; `null` for a language that has no text yet. */
export function toTranslationMap(
  texts: Partial<Record<Locale, CaseText>>,
): Record<Locale, CaseText | null> {
  return { ru: texts.ru ?? null, en: texts.en ?? null };
}

/** A copy of `value` without the keys whose value is `undefined`. */
export function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
