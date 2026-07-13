import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CaseModule } from './case/case.module';

@Module({
  imports: [CaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
