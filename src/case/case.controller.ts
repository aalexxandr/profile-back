import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { Case } from './models/case.model';

@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  createCase(@Body() caseDataDto: CreateCaseDto): Promise<Case> {
    console.log('Creating case with data:', caseDataDto);
    return this.caseService.createCase(caseDataDto);
  }

  @Get()
  findAll() {
    return this.caseService.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.caseService.findBySlug(slug);
  }
}
