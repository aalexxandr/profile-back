#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ab31ef1c0034b805c341872d8fbc2d2fb5d7e8bdf26491cfc969260df62536b5/contract';
import endContract from '../../snapshots/ab31ef1c0034b805c341872d8fbc2d2fb5d7e8bdf26491cfc969260df62536b5/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'Role',
        members: ['FRONTEND', 'FULLSTACK'],
      }),
      this.createTable({
        schema: 'public',
        table: 'cases',
        columns: [
          col('achievements', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('company', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ended_at', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('project_link', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('published', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('role', '"Role"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Role' } },
          }),
          col('short_description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sort_order', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('stack', 'text[]', { notNull: true, codecRef: { codecId: 'pg/text@1', many: true } }),
          col('started_at', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('team_size', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [
          primaryKey(['slug']),
          checkExpression(
            'cases_stack_elem_not_null_e2a6c8b5',
            sql`array_position("stack", NULL) IS NULL`,
          ),
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
