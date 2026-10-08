---
description: Прогнать typecheck, lint и тесты, исправить найденные ошибки
allowed-tools: Bash(pnpm run check), Bash(pnpm run lint:fix), Bash(pnpm run format), Bash(pnpm run typecheck), Bash(pnpm test*)
---

Выполни `pnpm run check` (typecheck, lint и unit-тесты; e2e в него не входят и запускаются отдельно: `pnpm run test:e2e --runInBand`, нужна локальная БД, если тест её использует). Если есть ошибки:

1. Сначала `pnpm run lint:fix` и `pnpm run format` для автоисправимого.
2. Остальное исправь вручную в коде, не отключая правила и не ослабляя tsconfig.
3. Повтори `pnpm run check`, пока не будет зелёным.

В конце кратко перечисли, что исправлено. Если ошибку нельзя исправить без решения пользователя, остановись и спроси.
