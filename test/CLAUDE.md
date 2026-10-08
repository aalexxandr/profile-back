# Конвенции тестов

- Unit-тесты: `*.spec.ts` рядом с кодом; e2e: `test/*.e2e-spec.ts` (конфиг `test/jest-e2e.json`, запуск `pnpm run test:e2e --runInBand`).
- E2E поднимают приложение через `configureApp()` из `src/app.setup.ts`, чтобы совпадать с продом (ValidationPipe, фильтры, middleware).
- Новый функционал, который стоит покрыть тестами, покрывается тестами в том же изменении. Как писать тесты — скилл `writing-tests`.
- Два вида e2e: **без БД** (свои `controllers`/`providers`-заглушки поверх `configureApp()`, образец `test/app-setup.e2e-spec.ts`) и **с БД** (`AppModule` целиком). Без БД предпочтительнее, когда реальный запрос к Prisma не важен.
- E2E с БД работают с реальной локальной БД: данные создаются с уникальным значением и удаляются в конце. Схема должна быть уже применена. Никогда не запускать на production-БД (`assertSafeDatabase` это блокирует).
- В e2e логи заглушены; `DEBUG_TESTS=1 pnpm run test:e2e --runInBand` возвращает их (см. `test/setup-e2e.ts`).
- Покрытие: `pnpm run test:cov` (только unit, пороги в `package.json`, проверяются в CI). Из покрытия исключены заглушки, `case/**` и файлы, которые проверяет e2e; когда в заглушке появится логика, уберите её из `collectCoverageFrom`.
- Образцы: `src/filters/all-exeption.filter.spec.ts`, `src/prisma/prisma.service.spec.ts`, `test/app-setup.e2e-spec.ts`. Модуль `case` тестовый и будет удалён: тестов на него нет.
- Помощники в `test/helpers/`: `createTestApp({...})` (приложение через `configureApp()`; закрывать в `afterAll`), `assertSafeDatabase` (e2e не стартуют, если `POSTGRES_URI` не локальный), `uniqueId(prefix, maxLength)` (уникальные данные).
- Очистка в e2e с БД: удалять только свои записи (по значению из `uniqueId`) в `afterAll` через `app.get(PrismaService)`, затем `app.close()`. Общий хелпер очистки не вводим, пока нет второй модели.
