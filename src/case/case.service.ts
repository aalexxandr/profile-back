import { Injectable, NotImplementedException } from '@nestjs/common';
import { CreateCaseDto } from './dto/create-case.dto';
import { Case } from './models/case.model';

@Injectable()
export class CaseService {
  createCase(_caseData: CreateCaseDto): Promise<Case> {
    void _caseData;
    throw new NotImplementedException(
      'Case persistence must be implemented with Prisma',
    );
  }

  findAll(): Promise<Case[]> {
    throw new NotImplementedException(
      'Case persistence must be implemented with Prisma',
    );
  }

  findBySlug(_slug: string): Promise<Case> {
    void _slug;
    throw new NotImplementedException(
      'Case persistence must be implemented with Prisma',
    );
  }
}
