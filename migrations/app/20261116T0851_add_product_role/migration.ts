#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5aeaaebfecd763bd694a04858deb8787dcdbc03133321dedca9f6750c85a67b4/contract';
import endContract from '../../snapshots/5aeaaebfecd763bd694a04858deb8787dcdbc03133321dedca9f6750c85a67b4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/def643fb08459ac1b2cfcccd247bf2fd495c56cd62e46758cd607cabffd3be33/contract';
import startContract from '../../snapshots/def643fb08459ac1b2cfcccd247bf2fd495c56cd62e46758cd607cabffd3be33/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.addNativeEnumValue({ schema: 'public', typeName: 'Role', value: 'PRODUCT' })];
  }
}

MigrationCLI.run(import.meta.url, M);
