#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ab31ef1c0034b805c341872d8fbc2d2fb5d7e8bdf26491cfc969260df62536b5/contract';
import startContract from '../../snapshots/ab31ef1c0034b805c341872d8fbc2d2fb5d7e8bdf26491cfc969260df62536b5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e63d08fdb6f1b7abd668e4dc6c5a310773c76e4058584bd44e0c6b778ebbaff9/contract';
import endContract from '../../snapshots/e63d08fdb6f1b7abd668e4dc6c5a310773c76e4058584bd44e0c6b778ebbaff9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'cases',
        column: col('blur_image', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'cases',
        column: col('image_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
