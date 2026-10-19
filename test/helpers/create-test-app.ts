import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../src/app.setup';
import { StorageService } from '../../src/storage/storage.service';
import { assertSafeDatabase } from './assert-safe-database';
import { InMemoryStorage } from './in-memory-storage';

/**
 * Поднимает приложение так же, как в проде (`configureApp`): ValidationPipe,
 * фильтр ошибок, logger, Swagger. Закрывайте его в `afterAll`.
 *
 * Весь AppModule с БД: `createTestApp({ imports: [AppModule] })`.
 * Без БД: передайте свои controllers/providers (заглушки).
 *
 * `StorageService` всегда заменён на `InMemoryStorage`, чтобы тесты никогда
 * не трогали настоящий бакет (даже если в окружении есть ключи S3). Достать
 * его для проверок: `app.get(StorageService) as unknown as InMemoryStorage`.
 */
export async function createTestApp(
  metadata: ModuleMetadata,
  storage: InMemoryStorage = new InMemoryStorage(),
): Promise<INestApplication> {
  assertSafeDatabase(process.env.POSTGRES_URI);

  const moduleRef = await Test.createTestingModule(metadata)
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}
