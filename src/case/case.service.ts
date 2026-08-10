import { Injectable } from '@nestjs/common';
import { CreateCaseDto } from './dto/create-case.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Case } from '../generated/prisma/client';

@Injectable()
export class CaseService {
  constructor(private readonly prismaService: PrismaService) {}
  createCase(caseData: CreateCaseDto): Promise<Case> {
    return this.prismaService.case.create({
      data: {
        slug: caseData.slug,
        name: caseData.name,
        projectLink: caseData.projectLink,
        category: caseData.category,
        stack: caseData.stack,
        shortDescription: caseData.shortDescription,
        description: caseData.description,
        role: caseData.role,
        achievements: caseData.achievements,
      },
    });
  }

  findAll(): Promise<Case[]> {
    return this.prismaService.case.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findBySlug(_slug: string): Promise<Case | null> {
    return this.prismaService.case.findUnique({
      where: {
        slug: _slug,
      },
    });
  }
}
