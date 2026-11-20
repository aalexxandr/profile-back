import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RequestTimeoutInterceptor } from './request-timeout.interceptor';
import { REQUEST_TIMEOUT, REQUEST_TIMEOUT_MS } from './timeout.constants';
import { TimeoutService } from './timeout.service';

/**
 * The timeout policy of the app: a global limit on every incoming request
 * (`503`) and `TimeoutService` for outgoing calls (`504`). Global, so any
 * module injects `TimeoutService` without importing this one.
 */
@Global()
@Module({
  providers: [
    TimeoutService,
    { provide: REQUEST_TIMEOUT, useValue: REQUEST_TIMEOUT_MS },
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
  ],
  exports: [TimeoutService],
})
export class TimeoutModule {}
