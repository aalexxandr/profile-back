import {
  CallHandler,
  ExecutionContext,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom, map, Observable, throwError, timer } from 'rxjs';

import { RequestTimeoutInterceptor } from './request-timeout.interceptor';
import { REQUEST_TIMEOUT_MESSAGE } from './timeout.constants';

const context = {} as ExecutionContext;

function handlerOf(source: Observable<unknown>): CallHandler {
  return { handle: () => source };
}

function respondAfter(ms: number, value: unknown) {
  return handlerOf(timer(ms).pipe(map(() => value)));
}

describe('RequestTimeoutInterceptor', () => {
  it('answers 503 when the handler is slower than the limit', async () => {
    const interceptor = new RequestTimeoutInterceptor(20);

    const error: unknown = await firstValueFrom(
      interceptor.intercept(context, respondAfter(200, { ok: true })),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toBe(
      REQUEST_TIMEOUT_MESSAGE,
    );
  });

  it('passes the value of a handler that finishes in time', async () => {
    const interceptor = new RequestTimeoutInterceptor(200);

    await expect(
      firstValueFrom(
        interceptor.intercept(context, respondAfter(5, { ok: true })),
      ),
    ).resolves.toEqual({ ok: true });
  });

  it('passes an error raised within the limit unchanged', async () => {
    const interceptor = new RequestTimeoutInterceptor(200);
    const notFound = new NotFoundException('Case not found');

    await expect(
      firstValueFrom(
        interceptor.intercept(context, handlerOf(throwError(() => notFound))),
      ),
    ).rejects.toBe(notFound);
  });
});
