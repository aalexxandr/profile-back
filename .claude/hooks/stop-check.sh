#!/usr/bin/env bash
# Stop: не даёт завершить работу при ошибках типов или линтера.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

active=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).stop_hook_active?"1":"")}catch{}})')
[ -n "$active" ] && exit 0

if ! out=$(pnpm run --silent typecheck 2>&1); then
  printf 'Typecheck failed:\n%s\n' "$out" >&2
  exit 2
fi
if ! out=$(pnpm run --silent lint 2>&1); then
  printf 'Lint failed:\n%s\n' "$out" >&2
  exit 2
fi
if ! out=$(pnpm run --silent test 2>&1); then
  printf 'Unit tests failed:\n%s\n' "$out" >&2
  exit 2
fi

# Напоминание: код в src изменён, а тестов в изменениях нет. Срабатывает один
# раз (см. stop_hook_active выше); осознанный отказ допустим, если объяснить.
changed=$(git status --porcelain -uall 2>/dev/null | grep -vE '^( D|D )' | cut -c4- | sed 's/.* -> //')
code=$(printf '%s\n' "$changed" | grep -E '^src/.*\.ts$' | grep -vE '\.spec\.ts$|\.module\.ts$|^src/main\.ts$|^src/generated/')
tests=$(printf '%s\n' "$changed" | grep -E '\.(e2e-)?spec\.ts$')
if [ -n "$code" ] && [ -z "$tests" ]; then
  printf 'Изменён код в src, но тестов в изменениях нет:\n%s\n\nНапиши тесты по скиллу writing-tests (или команде /add-tests). Если тест не нужен (документация, конфиг, рефакторинг без смены поведения, заглушка), коротко объясни почему и завершай работу.\n' "$code" >&2
  exit 2
fi
