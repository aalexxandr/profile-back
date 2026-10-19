import { Module } from '@nestjs/common';

import { ImageModule } from '../image/image.module';
import { StorageModule } from '../storage/storage.module';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';

@Module({
  imports: [StorageModule, ImageModule],
  controllers: [CaseController],
  providers: [CaseService],
})
export class CaseModule {}
