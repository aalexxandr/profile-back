import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';

import { getSwaggerConfig } from '../config/swagger.config';

export function setupSwagger(app: INestApplication) {
  const swaggerConfig = getSwaggerConfig();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('/docs', app, document);
}
