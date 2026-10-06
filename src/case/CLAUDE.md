# Конвенции feature-модуля (на примере `case/`)

- Слои: `*.controller.ts` (только маршрутизация, без логики) → `*.service.ts` → `PrismaService`. Контроллер не обращается к БД напрямую.
- DTO лежат в `dto/`, это классы с декораторами class-validator и `!` у полей. Глобальный `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) настроен в `configureApp()`, поэтому поле без декоратора будет отклонено. Enum-ы берутся из `src/prisma/enums.ts`.
- Новая модель БД: добавить её в `prisma/contract.prisma`, выполнить `pnpm run db:generate`, затем добавить геттер в `src/prisma/prisma.service.ts` (как `get cases()`).
- Запросы пишутся в стиле Prisma 8 ORM: `.create({...})`, `.first({ slug })`, `.orderBy(row => row.createdAt.desc()).all()`. Не использовать `findMany`/`where`.
- Модуль регистрируется в `AppModule`; `PrismaModule` импортируется там, где нужен доступ к БД.
- Импорты сортируются автоматически (`simple-import-sort`); неиспользуемые удаляются линтером.
