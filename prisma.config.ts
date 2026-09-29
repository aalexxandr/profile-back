import 'dotenv/config';
import { definePrismaConfig } from 'prisma/config';
import { defineConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  orm: defineConfig({
    contract: 'prisma/contract.prisma',
    output: 'src/generated/prisma',
    db: { connection: process.env['POSTGRES_URI'] },
  }),
});
