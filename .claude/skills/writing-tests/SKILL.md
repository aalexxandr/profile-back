---
name: writing-tests
description: Написание и обновление автотестов (unit и e2e) для этого NestJS-проекта по его конвенциям. Использовать при добавлении нового функционала, DTO, эндпоинта, фильтра, пайпа или исправлении бага, а также когда просят написать, дополнить или починить тесты.
---

# Написание тестов в profile-back

Модуль `case` тестовый и будет удалён: тесты для него не пишем и на него в примерах не опираемся. Конвенции расположения: `test/CLAUDE.md`.

## Образцы (делай по их стилю)

| Что пишешь                                          | Образец                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| unit: фильтр, пайп, guard, мок `ArgumentsHost`      | `src/filters/all-exeption.filter.spec.ts`          |
| unit: middleware                                    | `src/common/middlewares/logger.middleware.spec.ts` |
| unit: сервис с моком внешнего модуля                | `src/prisma/prisma.service.spec.ts`                |
| e2e без БД (заглушка-контроллер + `configureApp()`) | `test/app-setup.e2e-spec.ts`                       |
| тесты помощников                                    | `test/helpers/helpers.e2e-spec.ts`                 |

Помощники: `test/helpers/create-test-app.ts`, `assert-safe-database.ts`, `unique-id.ts`.

## Шаг 0. Решить, нужен ли тест

Тест нужен, если изменилось поведение:

- новый или изменённый эндпоинт → e2e;
- новое или изменённое DTO / правила валидации → unit;
- логика в сервисе, фильтре, пайпе, guard, interceptor → unit;
- исправление бага → сначала тест, воспроизводящий баг (он красный), потом исправление.

Тест не нужен для правок документации и конфигов, переименований без смены поведения, пустых заглушек. Если пропускаешь тест там, где он уместен, скажи об этом пользователю и почему.

## Шаг 1. Выбрать уровень

| Что проверяем                                                 | Уровень | Файл                                     |
| ------------------------------------------------------------- | ------- | ---------------------------------------- |
| DTO, фильтр, пайп, чистая функция, сервис с ветвлением        | unit    | `src/<путь>/<имя>.spec.ts` рядом с кодом |
| Эндпоинт целиком (валидация, контроллер, БД, ответ об ошибке) | e2e     | `test/<модуль>.e2e-spec.ts`              |

Тонкий сервис-прокладка к Prisma отдельным unit-тестом не покрываем: цепочку ORM Prisma 8 (`.orderBy(...).all()`) не мокаем, её проверяет e2e на реальной БД.

## Шаг 2. Написать тест

Общие правила:

- Название описывает поведение: `возвращает 404, если кейс не найден`. Один тест проверяет одну вещь.
- Структура Arrange / Act / Assert. Тесты независимы и не рассчитывают на порядок.
- Данные строим фабрикой с переопределениями (`validItem({ name: '' })`), а не копируем объекты целиком.
- Без `any`, `eslint-disable`, `it.skip` без причины. Неиспользуемые аргументы начинаются с `_`. ESLint строгий (`no-floating-promises`, `no-unsafe-argument`): `await` на всех промисах.
- Не ослабляй проверки ради зелёного теста. Если тест выявил баг в коде, исправь код или сообщи пользователю.

### Unit: DTO

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateItemDto } from './create-item.dto'; // имя примера, подставь своё

// фабрика валидного объекта: каждый тест меняет одно поле
const validItem = (overrides: Record<string, unknown> = {}) => ({
  name: 'Name',
  tags: ['nestjs'],
  ...overrides,
});

const errorsFor = (data: object) =>
  validate(plainToInstance(CreateItemDto, data));

it.each([
  ['слишком длинное имя', { name: 'a'.repeat(101) }],
  ['пустой список tags', { tags: [] }],
])('отклоняет: %s', async (_name, overrides) => {
  expect(await errorsFor(validItem(overrides))).not.toHaveLength(0);
});
```

Типичные ловушки строгого ESLint (правило «не отключай, исправь код»):

- моки типизируй: `jest.fn<ReturnType, [ArgType]>()` (так в `@types/jest` проекта), а не голый `jest.fn()` с `any`;
- `expect.any(String)` приводи к типу: `expect.any(String) as string`;
- не передавай метод объекта в `expect(obj.method)` (правило `unbound-method`): держи мок в отдельной переменной;
- `await` на всех промисах, в `afterAll` закрывай приложение.

Для граничных значений проверяй обе стороны: максимум проходит, максимум + 1 нет.

### Unit: фильтр, пайп, guard

Мокай только внешнюю границу (`ArgumentsHost`, `Response`, `PrismaService`). Логгер заглушай: `jest.spyOn(Logger.prototype, 'error').mockImplementation()`. Для сервисов собирай модуль через `Test.createTestingModule` с `{ provide: PrismaService, useValue: {...} }`, типизируя мок, а не приводя к `any`.

### E2E

Скелет (e2e с БД; без БД передай свои `controllers`/`providers`, см. `test/app-setup.e2e-spec.ts`):

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { uniqueId } from './helpers/unique-id';

describe('Items (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  const id = uniqueId('e2e'); // уникальное значение для данных теста

  beforeAll(async () => {
    // createTestApp вызывает configureApp() и проверяет, что БД локальная
    app = await createTestApp({ imports: [AppModule] });
    server = app.getHttpServer() as typeof server;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    // удалить только записи с нашим id через prisma
    await app.close();
  });
});
```

Правила e2e:

- Всегда `createTestApp(...)` (внутри `configureApp()`), не собирай приложение вручную.
- Уникальные данные через `uniqueId` (учитывай лимиты длины полей), удаляем только свои записи, приложение закрываем в `afterAll`.
- Работает с реальной локальной БД. Никогда не запускай на production. Схема должна быть применена; `db:init`, `db:update`, `db:migrate` и `prisma db *` запускает пользователь, не ты (они закрыты в `.claude/settings.json`).
- Проверяй статус и важные поля тела, а не весь JSON целиком (`createdAt` и подобные меняются).
- Для каждого эндпоинта минимум: успешный путь, невалидный ввод (400), «не найдено» / конфликт, если применимо.

## Шаг 3. Запустить

```bash
pnpm test -- <путь-к-файлу>          # unit
pnpm run test:e2e --runInBand        # e2e (нужна БД)
pnpm run check                       # typecheck + lint + unit, перед завершением
```

Если e2e запустить нельзя (нет БД), скажи пользователю явно, что e2e не прогонялся, и не называй работу проверенной.

## Шаг 4. Закрыть работу

- Чек-лист: тест красный до фикса (для багов), зелёный после; нет `skip`/`any`; `pnpm run check` зелёный.
- Если изменилась архитектура или команды, обнови `CLAUDE.md` и `README.md`.
- Коммит в формате Conventional Commits: `test(<scope>): ...` или `fix(<scope>): ...` вместе с тестом.
