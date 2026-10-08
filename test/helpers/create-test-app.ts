import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../src/app.setup';
import { assertSafeDatabase } from './assert-safe-database';

/**
 * Поднимает приложение так же, как в проде (`configureApp`): ValidationPipe,
 * фильтр ошибок, logger, Swagger. Закрывайте его в `afterAll`.
 *
 * Весь AppModule с БД: `createTestApp({ imports: [AppModule] })`.
 * Без БД: передайте свои controllers/providers (заглушки).
 */
export async function createTestApp(
  metadata: ModuleMetadata,
): Promise<INestApplication> {
  assertSafeDatabase(process.env.POSTGRES_URI);

  const moduleRef = await Test.createTestingModule(metadata).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}
