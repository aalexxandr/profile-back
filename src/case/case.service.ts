import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ImageProcessingService } from '../image/image-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  IMAGE_SLOTS,
  PUBLISH_NEEDS_ALL_LANGUAGES,
  SUPPORTED_LOCALES,
} from './case.constants';
import {
  CaseFullView,
  CaseImageSlot,
  CaseRow,
  CaseText,
  CaseView,
  CaseWithTranslations,
  Locale,
} from './case.types';
import { pictureColumns, pictureKey } from './case-image.util';
import {
  canBePublished,
  isCompleteText,
  omitUndefined,
  pickText,
  selectTranslation,
  textsByLocale,
  toTranslationMap,
} from './case-translation.util';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  /**
   * Creates the case and its translations together. A case can be published
   * only if it is created with every supported language.
   */
  async createCase(caseData: CreateCaseDto): Promise<CaseFullView> {
    const { translations } = caseData;
    const given = SUPPORTED_LOCALES.filter((locale) => translations[locale]);
    if (caseData.published && !canBePublished(given)) {
      throw new BadRequestException(PUBLISH_NEEDS_ALL_LANGUAGES);
    }

    return this.prismaService.transaction(async (tx) => {
      const row = await tx.orm.public.Case.create({
        slug: caseData.slug,
        projectLink: caseData.projectLink,
        stack: caseData.stack,
        role: caseData.role,
        company: caseData.company ?? null,
        teamSize: caseData.teamSize ?? null,
        startedAt: caseData.startedAt,
        endedAt: caseData.endedAt ?? null,
        sortOrder: caseData.sortOrder ?? 0,
        published: caseData.published ?? false,
      });

      const stored: Partial<Record<Locale, CaseText>> = {};
      for (const locale of given) {
        const text = translations[locale];
        if (!text) continue;
        const created = await tx.orm.public.CaseTranslation.create({
          caseSlug: row.slug,
          locale,
          ...pickText(text),
        });
        stored[locale] = pickText(created);
      }
      return this.toAdminView(row, stored);
    });
  }

  async findAll(locale: Locale): Promise<CaseView[]> {
    const rows = await this.prismaService.cases
      .where({ published: true })
      .orderBy([(row) => row.sortOrder.asc(), (row) => row.createdAt.desc()])
      .include('translations')
      .all();
    return rows.flatMap((row) => this.toView(row, locale) ?? []);
  }

  async findBySlug(slug: string, locale: Locale): Promise<CaseView> {
    const row = await this.prismaService.cases
      .where({ slug, published: true })
      .include('translations')
      .first();
    const view = row && this.toView(row, locale);
    if (!view) throw new NotFoundException('Case not found');
    return view;
  }

  /**
   * Merges the sent fields into the stored case: language-independent fields
   * as they are, translations per language and per field (`achievements` as a
   * whole). The two-language rule for `published` is checked on the resulting
   * state, before anything is written.
   */
  async updateCase(
    slug: string,
    caseData: UpdateCaseDto,
  ): Promise<CaseFullView> {
    const { translations: patches, ...rest } = caseData;
    const caseFields = omitUndefined(rest);

    return this.prismaService.transaction(async (tx) => {
      const current = await tx.orm.public.Case.where({ slug })
        .include('translations')
        .first();
      if (!current) throw new NotFoundException('Case not found');
      const { translations: storedRows, ...currentRow } = current;

      const stored = textsByLocale(storedRows);
      const merged = { ...stored };
      const writes: Array<() => Promise<unknown>> = [];
      for (const locale of SUPPORTED_LOCALES) {
        const patch = patches?.[locale];
        if (!patch) continue;
        const fields = omitUndefined(patch);
        const existing = stored[locale];
        if (existing) {
          merged[locale] = { ...existing, ...fields };
          writes.push(async () => {
            const updated = await tx.orm.public.CaseTranslation.where({
              caseSlug: slug,
              locale,
            }).update(fields);
            if (!updated) throw new NotFoundException('Case not found');
          });
        } else {
          if (!isCompleteText(fields)) {
            throw new BadRequestException(
              `The ${locale} translation does not exist yet, so it must be sent complete: name, category, shortDescription, description and achievements`,
            );
          }
          merged[locale] = pickText(fields);
          writes.push(() =>
            tx.orm.public.CaseTranslation.create({
              caseSlug: slug,
              locale,
              ...pickText(fields),
            }),
          );
        }
      }

      const published = caseFields.published ?? current.published;
      const present = SUPPORTED_LOCALES.filter((locale) => merged[locale]);
      if (published && !canBePublished(present)) {
        throw new BadRequestException(PUBLISH_NEEDS_ALL_LANGUAGES);
      }

      let row: CaseRow = currentRow;
      if (Object.keys(caseFields).length > 0) {
        const updated = await tx.orm.public.Case.whereUnique({
          slug,
        }).update(caseFields);
        if (!updated) throw new NotFoundException('Case not found');
        row = updated;
      }
      for (const write of writes) await write();

      return this.toAdminView(row, merged);
    });
  }

  async deleteCase(slug: string): Promise<void> {
    const row = await this.prismaService.cases.whereUnique({ slug }).delete();
    if (!row) throw new NotFoundException('Case not found');
    for (const key of [row.imageKey, row.backgroundImageKey]) {
      if (key) await this.removeObject(key);
    }
  }

  /** Sets or replaces the picture of a case. */
  setImage(slug: string, file: Buffer): Promise<CaseFullView> {
    return this.setPicture(slug, file, 'image');
  }

  /** Clears the picture; repeating it on a case without one is a no-op. */
  removeImage(slug: string): Promise<void> {
    return this.removePicture(slug, 'image');
  }

  /** Sets or replaces the background of a case; the picture is not touched. */
  setBackground(slug: string, file: Buffer): Promise<CaseFullView> {
    return this.setPicture(slug, file, 'background');
  }

  /** Clears the background; repeating it on a case without one is a no-op. */
  removeBackground(slug: string): Promise<void> {
    return this.removePicture(slug, 'background');
  }

  /**
   * Replaces one picture of a case. The new object is stored and the row saved
   * before the previous object is removed, so a failure never leaves the case
   * pointing at nothing.
   */
  private async setPicture(
    slug: string,
    file: Buffer,
    slot: CaseImageSlot,
  ): Promise<CaseFullView> {
    const current = await this.prismaService.cases.first({ slug });
    if (!current) throw new NotFoundException('Case not found');
    const currentKey = current[IMAGE_SLOTS[slot].keyColumn];

    const { image, blur } = await this.imageProcessingService.process(file);
    // read before any side effect, so a failure here leaves storage untouched
    const translations = await this.prismaService.caseTranslations
      .where({ caseSlug: slug })
      .all();
    const key = pictureKey(slug, slot, image);
    await this.storageService.put(key, image, 'image/webp');

    let updated: CaseRow | null;
    try {
      updated = await this.prismaService.cases
        .whereUnique({ slug })
        .update(pictureColumns(slot, key, blur));
    } catch (error) {
      await this.discardNewObject(key, currentKey);
      throw error;
    }
    if (!updated) {
      await this.discardNewObject(key, currentKey);
      throw new NotFoundException('Case not found');
    }

    if (currentKey && currentKey !== key) await this.removeObject(currentKey);
    return this.toAdminView(updated, textsByLocale(translations));
  }

  private async removePicture(
    slug: string,
    slot: CaseImageSlot,
  ): Promise<void> {
    const current = await this.prismaService.cases.first({ slug });
    if (!current) throw new NotFoundException('Case not found');
    const currentKey = current[IMAGE_SLOTS[slot].keyColumn];
    if (!currentKey) return;

    const updated = await this.prismaService.cases
      .whereUnique({ slug })
      .update(pictureColumns(slot, null, null));
    if (!updated) throw new NotFoundException('Case not found');

    await this.removeObject(currentKey);
  }

  /** Rolls back an upload, but never touches the object the case already uses. */
  private async discardNewObject(newKey: string, currentKey: string | null) {
    if (newKey !== currentKey) await this.removeObject(newKey);
  }

  /** Best effort: a leftover object is harmless, a failed request is not. */
  private async removeObject(key: string) {
    try {
      await this.storageService.delete(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete stored object ${key}: ${String(error)}`,
      );
    }
  }

  /** The public URL of a stored picture; the storage key itself stays internal. */
  private imageUrl(imageKey: string | null): string | null {
    return imageKey ? this.storageService.publicUrl(imageKey) : null;
  }

  /**
   * The flat view of one language: the requested translation, else Russian.
   * `null` when the case has nothing to serve, which a published case never has.
   */
  private toView(row: CaseWithTranslations, locale: Locale): CaseView | null {
    const { translations, ...caseRow } = row;
    const translation = selectTranslation(translations, locale);
    if (!translation) return null;
    return {
      ...caseRow,
      ...pickText(translation),
      locale: translation.locale,
      image: this.imageUrl(caseRow.imageKey),
      backgroundImage: this.imageUrl(caseRow.backgroundImageKey),
    };
  }

  /** The row with the text of every language and the picture URL. */
  private toAdminView(
    row: CaseRow,
    texts: Partial<Record<Locale, CaseText>>,
  ): CaseFullView {
    return {
      ...row,
      image: this.imageUrl(row.imageKey),
      backgroundImage: this.imageUrl(row.backgroundImageKey),
      translations: toTranslationMap(texts),
    };
  }
}
