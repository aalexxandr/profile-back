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
