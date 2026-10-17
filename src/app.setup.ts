import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { logger } from './common/middlewares/logger.middleware';
import { AllExceptionFilter } from './filters/all-exeption.filter';
import { setupSwagger } from './utils/swagger.util';

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
  // applies `@SerializeOptions` / `@Expose()` to every response
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  setupSwagger(app);

  app.enableShutdownHooks();
}
