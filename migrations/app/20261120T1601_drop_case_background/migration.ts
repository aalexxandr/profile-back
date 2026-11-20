#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/15036e07e2e8d1b754e71a34acf5a779d4d2da76dfa68aaaa2d1476049f22a50/contract';
import endContract from '../../snapshots/15036e07e2e8d1b754e71a34acf5a779d4d2da76dfa68aaaa2d1476049f22a50/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5aeaaebfecd763bd694a04858deb8787dcdbc03133321dedca9f6750c85a67b4/contract';
import startContract from '../../snapshots/5aeaaebfecd763bd694a04858deb8787dcdbc03133321dedca9f6750c85a67b4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: 'public', table: 'cases', column: 'background_blur_image' }),
      this.dropColumn({ schema: 'public', table: 'cases', column: 'background_image_key' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
