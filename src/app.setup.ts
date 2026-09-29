import { INestApplication, ValidationPipe } from '@nestjs/common';
import { logger } from './common/middlewares/logger.middleware';
import { AllExceptionFilter } from './filters/all-exeption.filter';

export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(logger);
  app.useGlobalFilters(new AllExceptionFilter());
  app.enableShutdownHooks();
}
