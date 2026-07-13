import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class CaseService {
  private readonly cases: { id: number; title: string; description: string }[];

  constructor() {
    this.cases = [
      { id: 1, title: 'Case 1', description: 'Description of Case 1' },
      { id: 2, title: 'Case 2', description: 'Description of Case 2' },
      { id: 3, title: 'Case 3', description: 'Description of Case 3' },
      { id: 4, title: 'Case 4', description: 'Description of Case 4' },
    ];
  }

  findAll() {
    return this.cases;
  }

  findById(id: number) {
    const foundCase = this.cases.find((c) => c.id === Number(id));
    if (!foundCase) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }
    return foundCase;
  }
}
