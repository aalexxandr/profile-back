import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AdminGuard } from './admin.guard';

/** Closes every route behind the admin token; `@Public()` opens a route. */
@Module({
  providers: [{ provide: APP_GUARD, useClass: AdminGuard }],
})
export class AuthModule {}
