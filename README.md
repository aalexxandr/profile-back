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

# S3-хранилище картинок (Selectel, бакет portfolio)
S3_ENDPOINT=https://s3.ru-1.storage.selcloud.ru
S3_REGION=ru-1
S3_BUCKET=portfolio
S3_ACCESS_KEY=replace_me
S3_SECRET_KEY=replace_me
S3_PUBLIC_URL=https://replace-me.example.com
```

Приложение и Prisma CLI читают именно `POSTGRES_URI`. Логин и пароль должны
соответствовать уже существующему тому PostgreSQL: изменение `.env` не меняет
пароль пользователя в инициализированной базе.

Все шесть переменных `S3_*` обязательны: без любой из них приложение не запустится
(так же, как без `POSTGRES_URI`). Ключи доступа создаются в панели Selectel
(сервисный пользователь с доступом к бакету). `S3_PUBLIC_URL` это публичный адрес,
по которому бакет отдаёт файлы без авторизации: скопируйте его из панели Selectel
(раздел «Хранилище», настройки бакета). К нему добавляется ключ объекта, например
`<S3_PUBLIC_URL>/cases/spectre/3f9a1c2b7d4e5f60.webp`. Миграция добавляет к `cases`
две колонки (`image_key`, `blur_image`), поэтому после обновления выполните
`pnpm run db:migrate`.

```bash
pnpm install --frozen-lockfile
docker compose --env-file .env up -d postgres
pnpm run db:migrate
pnpm run start:dev
```

`db:migrate` применяет миграции из `migrations/` к пустой базе (таблица `cases`).
`db:init` создаёт недостающие объекты базы напрямую по контракту, без записи в историю
миграций, и подходит только для быстрых экспериментов. Данные хранятся в Docker volume
`postgres_data`.

API: `http://localhost:3000/cases`, документация Swagger: `http://localhost:3000/docs`.
Порт приложения можно изменить переменной `PORT`.

### API кейсов

| Метод и путь                | Что делает                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /cases`                | Список опубликованных кейсов в сокращённом виде (`slug`, `name`, `category`, `stack`, `shortDescription`, `image`, `blurImage`), порядок: `sortOrder`, затем новые первыми |
| `GET /cases/:slug`          | Полный кейс (описание, роль, компания, команда, даты `startedAt` и `endedAt`, достижения, `image`, `blurImage`); `404` для неизвестного и неопубликованного                |
| `POST /cases`               | Создать кейс (по умолчанию черновик: `published = false`); `409` при занятом `slug`                                                                                        |
| `PATCH /cases/:slug`        | Частичное обновление; `slug` и картинку изменить нельзя                                                                                                                    |
| `DELETE /cases/:slug`       | Удалить кейс вместе с его картинкой, `204`                                                                                                                                 |
| `PUT /cases/:slug/image`    | Загрузить или заменить картинку кейса (multipart, поле `file`); `400` не картинка, `404` нет кейса, `413` больше 10 МБ                                                     |
| `DELETE /cases/:slug/image` | Убрать картинку кейса, `204` (повтор тоже `204`)                                                                                                                           |

Запросы на запись пока не защищены (планируется `admin-guard`), не публикуйте API в открытый доступ.

### Контракт API для фронтенда

Источник правды для типов фронтенда: OpenAPI-спецификация по адресу `GET /docs-json`
(локально `http://localhost:3000/docs-json`). Фронтенд генерирует из неё TypeScript-типы
командой в своём репозитории, адрес берётся из переменной окружения, по умолчанию
локальный бэкенд:

```bash
# во фронтенд-репозитории
OPENAPI_URL=${OPENAPI_URL:-http://localhost:3000/docs-json}
pnpm dlx openapi-typescript "$OPENAPI_URL" -o src/api/schema.d.ts
```

Правила:

- сгенерированный файл коммитится во фронтенд и руками не правится;
- типы отражают то, что запущено по адресу, а не то, что лежит в ветке: при разработке
  новой функции генерируйте с локального бэкенда, перед релизом с задеплоенного;
- точность типов зависит от Swagger-декораторов (`@ApiProperty` и др.), их проверяет
  `test/api-docs.e2e-spec.ts`;
- `/docs-json` открыт всегда и раскрывает всю поверхность API; если Swagger закроют
  в проде, источником придётся сделать файл спецификации.

### Картинки кейсов

Загружается одна обычная картинка, вторая версия (blur) создаётся сама:

```bash
curl -X PUT http://localhost:3000/cases/spectre/image -F "file=@photo.jpg"
curl -X DELETE http://localhost:3000/cases/spectre/image
```

Принимаются JPEG, PNG и WebP (формат определяется по содержимому файла, а не по
имени), до 10 МБ. Сервер перекодирует файл в настоящий WebP шириной не более
1920 px (маленькие не увеличивает, учитывает поворот EXIF, метаданные удаляет),
кладёт его в S3 под именем `cases/<slug>/<хеш содержимого>.webp` и делает
крошечную размытую копию (около 20 px).

В ответах API:

- `image`: абсолютный URL файла в S3, `null`, пока картинки нет;
- `blurImage`: строка `data:image/webp;base64,...`, её можно сразу подставить как
  заглушку (`<img src>`, `blurDataURL` в `next/image`), пока грузится `image`.

Кейс можно опубликовать и без картинки. При замене и удалении старый файл удаляется
из бакета (при сбое удаления остаётся неиспользуемый объект, запрос это не ломает).
Тесты никогда не обращаются к настоящему бакету: хранилище в них заменено на
in-memory заглушку, поэтому переменные `S3_*` для CI не нужны.

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
pnpm run test:cov       # unit-тесты с покрытием и порогами
```

Правило проекта — TDD (красный → зелёный → рефакторинг): для нового функционала и
багфиксов сначала пишется падающий тест, затем минимальный код, затем рефакторинг
(новый эндпоинт — e2e, DTO и логика — unit). Тесты идут в том же изменении, что и код. Конвенции — в `test/CLAUDE.md`;
для ИИ-агента есть скилл `writing-tests` и команда `/add-tests`.

Интеграционные тесты требуют доступной локальной базы с применённой схемой.
Они создают запись с уникальным тестовым slug, проверяют API и удаляют только её.
Используйте базу разработки, не production (помощник `assertSafeDatabase` не даст запустить e2e на нелокальной БД).
`pnpm test` запускает только unit-тесты (`src/**/*.spec.ts`) и не требует БД;
e2e (`test/*.e2e-spec.ts`) запускаются отдельно. Часть e2e обходится без БД.
Покрытие unit-тестами: `pnpm run test:cov` (пороги проверяются в CI).
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
