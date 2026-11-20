import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  catchError,
  Observable,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';

import { REQUEST_TIMEOUT, REQUEST_TIMEOUT_MESSAGE } from './timeout.constants';

/**
 * Answers `503` to any request not handled within the limit. It only stops
 * waiting: the handler's work is not cancelled, which is why outgoing calls
 * have their own, shorter limits (`TimeoutService`).
 */
@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  constructor(@Inject(REQUEST_TIMEOUT) private readonly limitMs: number) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout({ first: this.limitMs }),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new ServiceUnavailableException(REQUEST_TIMEOUT_MESSAGE)
            : error,
        ),
      ),
    );
  }
}
