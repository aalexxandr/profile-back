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

  async onModuleDestroy() {
    await this.client.close();
  }
}
