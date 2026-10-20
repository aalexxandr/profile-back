import { DEFAULT_LOCALE } from './case.constants';
import { Locale } from './case.types';

/**
 * Picks the language of a public read from the raw `lang` query value.
 * Only the exact string `en` selects English; anything else (missing,
 * unknown, repeated parameter) gives the default, so it never fails a request.
 */
export function resolveLocale(raw: unknown): Locale {
  return raw === 'en' ? 'en' : DEFAULT_LOCALE;
}
