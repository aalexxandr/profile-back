#!/usr/bin/env bash
# Stop: blocks finishing while typecheck, lint or unit tests fail.
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

# Reminder: src code changed but there are no tests in the changes. Fires once
# (see stop_hook_active above); a deliberate skip is fine if explained.
changed=$(git status --porcelain -uall 2>/dev/null | grep -vE '^( D|D )' | cut -c4- | sed 's/.* -> //')
code=$(printf '%s\n' "$changed" | grep -E '^src/.*\.ts$' | grep -vE '\.spec\.ts$|\.module\.ts$|^src/main\.ts$|^src/generated/')
tests=$(printf '%s\n' "$changed" | grep -E '\.(e2e-)?spec\.ts$')
if [ -n "$code" ] && [ -z "$tests" ]; then
  printf 'Code in src changed but there are no tests in the changes:\n%s\n\nWrite tests per the writing-tests skill (or the /add-tests command). If no test is needed (docs, config, refactor without behavior change, stub), briefly explain why and finish.\n' "$code" >&2
  exit 2
fi
