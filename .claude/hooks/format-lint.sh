#!/usr/bin/env bash
# PostToolUse (Edit|Write): форматирует и линтит изменённый .ts-файл.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{}})')

case "$file" in
  */src/generated/*) exit 0 ;;
  */src/*.ts | */test/*.ts) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

pnpm exec prettier --write "$file" >/dev/null 2>&1

if ! out=$(pnpm exec eslint --fix --max-warnings 0 "$file" 2>&1); then
  echo "$out" >&2
  exit 2
fi
