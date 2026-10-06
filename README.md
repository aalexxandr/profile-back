# Portfolio backend

NestJS 12, TypeScript 6 и Prisma ORM 8 (release candidate), PostgreSQL 18.
Нужны Node.js >= 24.11, pnpm и работающий Docker Desktop.
Все команды ниже выполняются из `profile-back`.

## Первый запуск

Создайте `.env` из шаблона (`cp .env.example .env`) и замените заглушки; реальные
пароли не коммитить. Пример содержимого:

```dotenv
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=replace_me
POSTGRES_DB=portfolio
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
POSTGRES_URI="postgresql://portfolio:replace_me@localhost:5434/portfolio"
```

Приложение и Prisma CLI читают именно `POSTGRES_URI`. Логин и пароль должны
соответствовать уже существующему тому PostgreSQL: изменение `.env` не меняет
пароль пользователя в инициализированной базе.

```bash
pnpm install --frozen-lockfile
docker compose --env-file .env up -d postgres
pnpm run db:init
pnpm run start:dev
```

`db:init` генерирует контракт и создаёт недостающие объекты базы. Использует
только добавляющие операции; несовместимая существующая структура вызывает ошибку.
Данные хранятся в Docker volume `postgres_data`.

API: `http://localhost:3000/cases`. Порт приложения можно изменить переменной `PORT`.

## Ежедневная работа

```bash
docker compose --env-file .env up -d postgres
pnpm run start:dev
```

Watch-режим Nest автоматически перекомпилирует приложение при изменении кода.
Чтобы остановить приложение, нажмите Ctrl+C. Чтобы остановить базу:

```bash
docker compose --env-file .env stop
```

## Prisma 8

Схема находится в `prisma/contract.prisma`, подключение и путь генерации —
в `prisma.config.ts`. Генерируются `src/generated/prisma/contract.json` и
`contract.d.ts`. Эти файлы не редактируют вручную и не коммитят.
В приложении используется `@prisma/orm-postgres`, а не Prisma Client 7.
Версии CLI и PostgreSQL runtime выпускаются независимо и могут различаться.

| Команда                | Назначение                                                   |
| ---------------------- | ------------------------------------------------------------ |
| `pnpm run db:generate` | Генерирует JSON-контракт и типы; базу не изменяет            |
| `pnpm run db:init`     | Генерирует контракт и инициализирует базу                    |
| `pnpm run db:plan`     | Показывает изменения между контрактом и базой без применения |
| `pnpm run db:update`   | Применяет изменения контракта к локальной базе               |
| `pnpm run db:verify`   | Проверяет соответствие базы контракту                        |

После изменения схемы при локальном прототипировании:

```bash
pnpm run db:plan
pnpm run db:update
```

Изменения, удаляющие данные, требуют отдельного подтверждения CLI.
Генерация автоматически выполняется перед сборкой и запуском приложения.
Прежние команды `prisma db push` и `prisma generate` к Prisma 8 не применяются.
Сообщение `prisma skills sync` относится к подсказкам для AI-агентов и не мешает ORM.

Для сохранения истории изменений используйте миграции вместо прямого `db:update`:

```bash
pnpm run db:migration:plan --name describe_change
pnpm run db:migrate
pnpm run db:verify
```

Планирование само генерирует актуальный контракт. Артефакты `migrations/` сохраняйте
в Git вместе со схемой; первая миграция после принятия существующей базы создаёт
также исходный снимок схемы.

## Проверки

```bash
pnpm run check          # typecheck + lint + тесты одной командой
pnpm run typecheck      # tsc --noEmit
pnpm run lint           # ESLint, предупреждения считаются ошибками
pnpm run format:check   # Prettier без изменения файлов
pnpm run build
pnpm run test:e2e --runInBand
```

Интеграционные тесты требуют доступной локальной базы с применённой схемой.
Они создают запись с уникальным тестовым slug, проверяют API и удаляют только её.
Используйте базу разработки, не production. `pnpm test` также запускает эти тесты.
Jest запускается с `--experimental-vm-modules` для ESM-зависимостей NestJS 12
и Prisma 8; предупреждение Node об экспериментальном VM API ожидаемо.

### Git-хуки и CI

После `pnpm install` скрипт `prepare` включает husky:

- `pre-commit`: `lint-staged` (ESLint и Prettier по изменённым файлам) и `secretlint` (поиск токенов и паролей);
- `commit-msg`: `commitlint`, сообщения в формате Conventional Commits (`feat: ...`, `fix(case): ...`).

GitHub Actions (`.github/workflows/ci.yml`) на каждый push в `main` и pull request
поднимает PostgreSQL 18 и выполняет typecheck, lint, format:check, тесты, e2e и сборку.
Dependabot раз в неделю предлагает обновления, major-версии `typescript` и `@types/node` игнорируются.

Для запуска собранного приложения:

```bash
pnpm run build
pnpm run start:prod
```

TypeScript намеренно ограничен веткой 6: Nest CLI и typescript-eslint пока
не поддерживают программный API TypeScript 7. `pnpm update --latest` обходит
ограничения версий, поэтому обновляйте основные версии по отдельности.
