# Конвенции тестов

- Unit-тесты: `*.spec.ts` рядом с кодом; e2e: `test/*.e2e-spec.ts` (конфиг `test/jest-e2e.json`, запуск `pnpm run test:e2e --runInBand`).
- E2E поднимают приложение через `configureApp()` из `src/app.setup.ts`, чтобы совпадать с продом (ValidationPipe, фильтры, middleware).
- Новый функционал, который стоит покрыть тестами, покрывается тестами в том же изменении. Как писать тесты — скилл `writing-tests`, план — `docs/testing-plan.md`.
- E2E работают с реальной локальной БД: записи создаются с уникальным slug и удаляются в конце. Схема должна быть уже применена. Никогда не запускать на production-БД.
- Помощники в `test/helpers/`: `createTestApp({...})` (приложение через `configureApp()`; закрывать в `afterAll`), `assertSafeDatabase` (e2e не стартуют, если `POSTGRES_URI` не локальный), `uniqueId(prefix, maxLength)` (уникальные данные).
- Очистка в e2e с БД: удалять только свои записи (по значению из `uniqueId`) в `afterAll` через `app.get(PrismaService)`, затем `app.close()`. Общий хелпер очистки не вводим, пока нет второй модели.
