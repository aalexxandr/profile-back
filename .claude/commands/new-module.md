---
description: Создать новый feature-модуль NestJS по конвенциям проекта (аргумент — имя модуля)
argument-hint: <имя-модуля>
---

Создай feature-модуль `$ARGUMENTS` в `src/$ARGUMENTS/` по образцу `src/case/` (прочитай `src/case/CLAUDE.md` и файлы модуля перед началом):

1. `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/create-<name>.dto.ts` с class-validator.
2. Если нужна новая таблица: добавь модель в `prisma/contract.prisma`, выполни `pnpm run db:generate` и добавь геттер в `src/prisma/prisma.service.ts`. Миграции и `db:update`/`db:migrate` не запускай, а предложи пользователю команды.
3. Зарегистрируй модуль в `src/app.module.ts`.
4. Прогони `pnpm run check`.
5. Если изменилась архитектура (новый модуль), обнови `CLAUDE.md` и `README.md`.
