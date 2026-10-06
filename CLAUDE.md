# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Portfolio backend: NestJS 12, TypeScript 6 (deliberately pinned to the 6.x branch — Nest CLI and typescript-eslint don't support TS 7 yet), Prisma ORM **8** (release candidate) on PostgreSQL 18. Node >= 24.11, pnpm. README.md (in Russian) has the full setup walkthrough.

## Commands

```bash
docker compose --env-file .env up -d postgres   # local DB on host port 5434
pnpm run db:init          # first run: generate contract + create missing DB objects
pnpm run start:dev        # watch mode (runs db:generate first), API on :3000 (PORT overrides)
pnpm run build            # db:generate + nest build
pnpm run lint             # eslint on src and test; lint:fix to autofix
pnpm run format           # prettier
pnpm test                 # jest (note: runs with --experimental-vm-modules)
pnpm run test:e2e --runInBand
pnpm test -- -t "name"    # single test by name; or pass a file path
```

Do not use `pnpm update --latest` (bypasses version pins); update major versions one at a time.

`.env` must define `POSTGRES_URI` — both the app (via `ConfigService.getOrThrow`) and Prisma CLI (`prisma.config.ts`) read it. E2E tests hit the real local DB (they create and delete a record with a unique slug), so the schema must already be applied and the DB must not be production.

## Prisma 8 (differs from Prisma 7 and earlier)

- There is **no Prisma Client**. Schema is `prisma/contract.prisma`; `pnpm run db:generate` (`prisma contract emit`) writes `src/generated/prisma/contract.json` + `contract.d.ts`. These are generated, not hand-edited, and not committed.
- Runtime is `@prisma/orm-postgres/runtime`. `PrismaService` (`src/prisma/prisma.service.ts`) builds a client from `contractJson` and exposes per-model accessors (e.g. `get cases()` → `client.orm.public.Case`). Add a getter there for each new model.
- Query API is the new ORM style (`.create({...})`, `.first({ slug })`, `.orderBy(row => row.createdAt.desc()).all()`), not `findMany`/`where`.
- Schema syntax is also new (`pg.enum(Role)`, `native_enum`, `temporal.updatedAtJsDate()`, `@map` for snake_case columns).
- Old commands `prisma db push` / `prisma generate` don't apply. Use `db:plan` → `db:update` for prototyping, or `db:migration:plan --name <name>` → `db:migrate` → `db:verify` to keep history. Files in `migrations/` are committed.
- Prisma skills are available under `.claude/skills` (e.g. prisma-upgrade-v7, prisma-client-api); the "prisma skills sync" CLI message can be ignored.

## Architecture

Standard Nest layout: feature modules under `src/` (currently only `case/`: controller → service → `PrismaService`, DTOs validated with class-validator). `PrismaModule` provides the DB service; `ConfigModule` is global.

App-wide setup lives in `configureApp()` (`src/app.setup.ts`), not `main.ts`, so e2e tests can reuse it: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), the `logger` middleware, `AllExceptionFilter`, Swagger (`src/utils/swagger.util.ts`, config in `src/config/swagger.config.ts`), and shutdown hooks. E2E tests should call `configureApp` to match production behavior.

## Keeping docs current

When a change alters the project's architecture (new or removed modules, changes to app-wide setup in `configureApp()`, the Prisma/DB workflow, commands, or env variables), update this `CLAUDE.md` and `README.md` in the same change so they don't drift from the code.

`.mcp.json` configures Postgres, GitHub, Context7 and Figma MCP servers.
