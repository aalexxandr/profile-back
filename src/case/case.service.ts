import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';

@Injectable()
export class CaseService {
  constructor(private readonly prismaService: PrismaService) {}
  createCase(caseData: CreateCaseDto) {
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
    });
  }

  async findAll() {
    return this.prismaService.cases
      .orderBy((row) => row.createdAt.desc())
      .all();
  }

  async findBySlug(slug: string) {
    return this.prismaService.cases.first({ slug });
  }
}
