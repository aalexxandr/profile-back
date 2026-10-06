# Конвенции тестов

- Unit-тесты: `*.spec.ts` рядом с кодом; e2e: `test/*.e2e-spec.ts` (конфиг `test/jest-e2e.json`, запуск `pnpm run test:e2e --runInBand`).
- E2E поднимают приложение через `configureApp()` из `src/app.setup.ts`, чтобы совпадать с продом (ValidationPipe, фильтры, middleware).
- E2E работают с реальной локальной БД: записи создаются с уникальным slug и удаляются в конце. Схема должна быть уже применена. Никогда не запускать на production-БД.
