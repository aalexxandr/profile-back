import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from '../generated/prisma/contract';
import contractJson from '../generated/prisma/contract.json';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: ReturnType<typeof postgres<Contract>>;

  constructor(config: ConfigService) {
    this.client = postgres<Contract>({
      url: config.getOrThrow<string>('POSTGRES_URI'),
      contractJson,
    });
  }

  get cases() {
    return this.client.orm.public.Case;
  }

  get caseTranslations() {
    return this.client.orm.public.CaseTranslation;
  }

  /** Runs `fn` in one database transaction: commits on return, rolls back on a throw. */
  transaction<T>(fn: Parameters<typeof this.client.transaction<T>>[0]) {
    return this.client.transaction(fn);
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
