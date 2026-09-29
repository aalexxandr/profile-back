import postgresStatic from '@prisma/orm-postgres/static';
import type { Contract } from '../generated/prisma/contract';
import contractJson from '../generated/prisma/contract.json';

export const { enums, nativeEnums } = postgresStatic<Contract>({
  contractJson,
});

export const Role = nativeEnums.public.Role.members;
export type Role = (typeof Role)[keyof typeof Role];
