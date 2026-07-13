import { Controller } from '@nestjs/common';
import { CaseService } from './case.service';

@Controller('case')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}
}
