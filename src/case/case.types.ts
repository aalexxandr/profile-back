import type { Models } from '../generated/prisma/contract';
import type { Locale as LocaleEnum } from '../prisma/enums';

/** Languages the text of a case can be served in. */
export type Locale = LocaleEnum;

/** A database row of the `cases` table, as the ORM returns it (no relations loaded). */
export type CaseRow = Omit<Models.public_Case, 'translations'>;

/** A database row of the `case_translations` table (no relations loaded). */
export type CaseTranslationRow = Omit<Models.public_CaseTranslation, 'case'>;

/** A case row with its translations loaded (`.include('translations')`). */
export type CaseWithTranslations = CaseRow & {
  translations: CaseTranslationRow[];
};

/** The text of a case in one language. */
export type CaseText = Pick<
  CaseTranslationRow,
  'name' | 'category' | 'shortDescription' | 'description' | 'achievements'
>;

/**
 * What the public reads hand to the response serializer: a row, the text in
 * the served language, that language, and the computed public URL of the
 * picture (`null` without one).
 */
export type CaseView = CaseRow &
  CaseText & { image: string | null; locale: Locale };

/**
 * The full view of a case after a write: a row, the computed picture URL
 * and the text in every language (`null` for a language not written yet).
 */
export type CaseFullView = CaseRow & {
  image: string | null;
  translations: Record<Locale, CaseText | null>;
};
