import { INestApplication } from '@nestjs/common';
import { getSwaggerConfig } from '../config/swagger.config';
import { SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const swaggerConfig = getSwaggerConfig();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('/docs', app, document);
}
