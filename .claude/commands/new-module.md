---
description: Создать новый feature-модуль NestJS по конвенциям проекта (аргумент — имя модуля)
argument-hint: <имя-модуля>
---

Создай feature-модуль `$ARGUMENTS` в `src/$ARGUMENTS/` по образцу `src/case/` (прочитай `src/case/CLAUDE.md` и файлы модуля перед началом):

1. `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/create-<name>.dto.ts` с class-validator.
2. Если нужна новая таблица: добавь модель в `prisma/contract.prisma`, выполни `pnpm run db:generate` и добавь геттер в `src/prisma/prisma.service.ts`. Миграции и `db:update`/`db:migrate` не запускай, а предложи пользователю команды.
3. Зарегистрируй модуль в `src/app.module.ts`.
4. Добавь тесты по скиллу `writing-tests`: unit-тест DTO (граничные значения), unit-тесты сервиса, если в нём есть логика, и e2e на эндпоинты по образцу `test/app-setup.e2e-spec.ts` (с БД, если нужна реальная Prisma; e2e запускай только при доступной локальной БД).
5. Прогони `pnpm run check`.
6. Если изменилась архитектура (новый модуль), обнови `CLAUDE.md` и `README.md`.
