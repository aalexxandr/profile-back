import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CaseRow } from './case.types';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Injectable()
export class CaseService {
  constructor(private readonly prismaService: PrismaService) {}
  createCase(caseData: CreateCaseDto): Promise<CaseRow> {
    return this.prismaService.cases.create({
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
  }

  async findAll(): Promise<CaseRow[]> {
    const rows = await this.prismaService.cases
      .where({ published: true })
      .orderBy([(row) => row.sortOrder.asc(), (row) => row.createdAt.desc()])
      .all();
    return rows;
  }

  async findBySlug(slug: string): Promise<CaseRow> {
    const row = await this.prismaService.cases.first({
      slug,
      published: true,
    });
    if (!row) throw new NotFoundException('Case not found');
    return row;
  }

  async updateCase(slug: string, caseData: UpdateCaseDto): Promise<CaseRow> {
    const row = await this.prismaService.cases
      .whereUnique({ slug })
      .update(caseData);
    if (!row) throw new NotFoundException('Case not found');
    return row;
  }

  async deleteCase(slug: string): Promise<void> {
    const row = await this.prismaService.cases.whereUnique({ slug }).delete();
    if (!row) throw new NotFoundException('Case not found');
  }
}
