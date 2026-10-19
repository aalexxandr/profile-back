import type { Models } from '../generated/prisma/contract';

/** A database row of the `cases` table, as the ORM returns it. */
export type CaseRow = Models.public_Case;

/**
 * A row plus the computed public URL of its picture (`null` without one).
 * This is what the service hands to the response serializer.
 */
export type CaseView = CaseRow & { image: string | null };
