import { createHash } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ImageProcessingService } from '../image/image-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CaseRow, CaseView } from './case.types';
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

  async createCase(caseData: CreateCaseDto): Promise<CaseView> {
    const row = await this.prismaService.cases.create({
      slug: caseData.slug,
      name: caseData.name,
      projectLink: caseData.projectLink,
      category: caseData.category,
      stack: caseData.stack,
      shortDescription: caseData.shortDescription,
      description: caseData.description,
      role: caseData.role,
      achievements: caseData.achievements,
      company: caseData.company ?? null,
      teamSize: caseData.teamSize ?? null,
      startedAt: caseData.startedAt,
      endedAt: caseData.endedAt ?? null,
      sortOrder: caseData.sortOrder ?? 0,
      published: caseData.published ?? false,
    });
    return this.toView(row);
  }

  async findAll(): Promise<CaseView[]> {
    const rows = await this.prismaService.cases
      .where({ published: true })
      .orderBy([(row) => row.sortOrder.asc(), (row) => row.createdAt.desc()])
      .all();
    return rows.map((row) => this.toView(row));
  }

  async findBySlug(slug: string): Promise<CaseView> {
    const row = await this.prismaService.cases.first({
      slug,
      published: true,
    });
    if (!row) throw new NotFoundException('Case not found');
    return this.toView(row);
  }

  async updateCase(slug: string, caseData: UpdateCaseDto): Promise<CaseView> {
    const row = await this.prismaService.cases
      .whereUnique({ slug })
      .update(caseData);
    if (!row) throw new NotFoundException('Case not found');
    return this.toView(row);
  }

  async deleteCase(slug: string): Promise<void> {
    const row = await this.prismaService.cases.whereUnique({ slug }).delete();
    if (!row) throw new NotFoundException('Case not found');
    if (row.imageKey) await this.removeObject(row.imageKey);
  }

  /**
   * Replaces the picture of a case. The new object is stored and the row saved
   * before the previous object is removed, so a failure never leaves the case
   * pointing at nothing.
   */
  async setImage(slug: string, file: Buffer): Promise<CaseView> {
    const current = await this.prismaService.cases.first({ slug });
    if (!current) throw new NotFoundException('Case not found');

    const { image, blur } = await this.imageProcessingService.process(file);
    const key = `cases/${slug}/${createHash('sha256').update(image).digest('hex').slice(0, 16)}.webp`;
    await this.storageService.put(key, image, 'image/webp');

    let updated: CaseRow | null;
    try {
      updated = await this.prismaService.cases
        .whereUnique({ slug })
        .update({ imageKey: key, blurImage: blur });
    } catch (error) {
      await this.discardNewObject(key, current.imageKey);
      throw error;
    }
    if (!updated) {
      await this.discardNewObject(key, current.imageKey);
      throw new NotFoundException('Case not found');
    }

    if (current.imageKey && current.imageKey !== key) {
      await this.removeObject(current.imageKey);
    }
    return this.toView(updated);
  }

  /** Clears the picture; repeating it on a case without one is a no-op. */
  async removeImage(slug: string): Promise<void> {
    const current = await this.prismaService.cases.first({ slug });
    if (!current) throw new NotFoundException('Case not found');
    if (!current.imageKey) return;

    const updated = await this.prismaService.cases
      .whereUnique({ slug })
      .update({ imageKey: null, blurImage: null });
    if (!updated) throw new NotFoundException('Case not found');

    await this.removeObject(current.imageKey);
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

  /** Adds the public URL of the picture; the storage key itself stays internal. */
  private toView(row: CaseRow): CaseView {
    return {
      ...row,
      image: row.imageKey ? this.storageService.publicUrl(row.imageKey) : null,
    };
  }
}
