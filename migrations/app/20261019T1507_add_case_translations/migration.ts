#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/acb8202efb7e98f03f23ef63da8343358bc02ae6bb15bba093d7c32ca462932d/contract';
import endContract from '../../snapshots/acb8202efb7e98f03f23ef63da8343358bc02ae6bb15bba093d7c32ca462932d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e63d08fdb6f1b7abd668e4dc6c5a310773c76e4058584bd44e0c6b778ebbaff9/contract';
import startContract from '../../snapshots/e63d08fdb6f1b7abd668e4dc6c5a310773c76e4058584bd44e0c6b778ebbaff9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

const TEXT_COLUMNS = ['achievements', 'category', 'description', 'name', 'short_description'] as const;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  // Order matters: the text is copied into `ru` translations and every case is
  // unpublished BEFORE the old columns are dropped. `db migrate` runs the whole
  // run in one transaction, so a failed step rolls everything back.
  override get operations() {
    return [
      this.createNativeEnumType({ schema: 'public', typeName: 'Locale', members: ['ru', 'en'] }),
      this.createTable({
        schema: 'public',
        table: 'case_translations',
        columns: [
          col('achievements', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('case_slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('locale', '"Locale"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Locale' } },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('short_description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['case_slug', 'locale'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'case_translations',
        index: 'case_translations_case_slug_idx_2342b752',
        columns: ['case_slug'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'case_translations',
        foreignKey: {
          name: 'case_translations_case_slug_fkey',
          columns: ['case_slug'],
          references: { schema: 'public', table: 'cases', columns: ['slug'] },
          onDelete: 'cascade',
        },
      }),
      rawSql({
        id: 'data.case_translations.copy_ru',
        label: 'Copy the text of every case into a "ru" translation',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'table', name: 'case_translations' },
        },
        precheck: [
          {
            description: 'ensure the old text columns still exist on "cases"',
            sql: `SELECT EXISTS (SELECT 1 FROM "information_schema"."columns" WHERE "table_schema" = 'public' AND "table_name" = 'cases' AND "column_name" = 'name') AS "result"`,
          },
        ],
        execute: [
          {
            description: 'insert one "ru" translation per case',
            sql: `INSERT INTO "public"."case_translations" ("case_slug", "locale", "name", "category", "short_description", "description", "achievements") SELECT "slug", 'ru'::"public"."Locale", "name", "category", "short_description", "description", "achievements" FROM "public"."cases"`,
          },
        ],
        postcheck: [
          {
            description: 'verify every case has a "ru" translation',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."cases" c WHERE NOT EXISTS (SELECT 1 FROM "public"."case_translations" t WHERE t."case_slug" = c."slug" AND t."locale" = 'ru'::"public"."Locale")) AS "result"`,
          },
        ],
      }),
      rawSql({
        id: 'data.cases.unpublish_all',
        label: 'Unpublish every case until its "en" translation is added',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'table', name: 'cases' },
        },
        precheck: [],
        execute: [
          {
            description: 'set published = false on all cases',
            sql: `UPDATE "public"."cases" SET "published" = false WHERE "published" = true`,
          },
        ],
        postcheck: [
          {
            description: 'verify no case is published',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."cases" WHERE "published" = true) AS "result"`,
          },
        ],
      }),
      ...TEXT_COLUMNS.map((column) => this.dropColumn({ schema: 'public', table: 'cases', column })),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
