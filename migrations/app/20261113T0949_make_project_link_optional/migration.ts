#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/bb3ddecf8c09506969e2bedf1595a9343ca2718696c8acb99d166839b398cadc/contract';
import startContract from '../../snapshots/bb3ddecf8c09506969e2bedf1595a9343ca2718696c8acb99d166839b398cadc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/def643fb08459ac1b2cfcccd247bf2fd495c56cd62e46758cd607cabffd3be33/contract';
import endContract from '../../snapshots/def643fb08459ac1b2cfcccd247bf2fd495c56cd62e46758cd607cabffd3be33/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropNotNull({ schema: 'public', table: 'cases', column: 'project_link' })];
  }
}

MigrationCLI.run(import.meta.url, M);
