import { Controller, Get, Param } from '@nestjs/common';
import { CaseService } from './case.service';

@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Get()
  findAll() {
    return this.caseService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.caseService.findById(id);
  }
}
