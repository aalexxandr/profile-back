#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/acb8202efb7e98f03f23ef63da8343358bc02ae6bb15bba093d7c32ca462932d/contract';
import startContract from '../../snapshots/acb8202efb7e98f03f23ef63da8343358bc02ae6bb15bba093d7c32ca462932d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bb3ddecf8c09506969e2bedf1595a9343ca2718696c8acb99d166839b398cadc/contract';
import endContract from '../../snapshots/bb3ddecf8c09506969e2bedf1595a9343ca2718696c8acb99d166839b398cadc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'cases',
        column: col('background_blur_image', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'cases',
        column: col('background_image_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
