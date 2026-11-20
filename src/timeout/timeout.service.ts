import { GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';

import { EXTERNAL_TIMEOUT_MESSAGE } from './timeout.constants';

/**
 * Bounds the time of a call to an external service. Every outgoing client
 * (storage today) runs its calls through `run`, so one place decides what a
 * slow dependency costs and what the client of the API sees (`504`).
 */
@Injectable()
export class TimeoutService {
  private readonly logger = new Logger(TimeoutService.name);

  /**
   * Runs `operation` for at most `ms`. On expiry the signal given to the
   * operation is aborted (pass it to the client so the request is really
   * cancelled) and the call rejects with `GatewayTimeoutException`. An error
   * raised within the limit is rethrown unchanged. `name` is only logged.
   */
  async run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    ms: number,
    name: string,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.logger.warn(`${name} did not respond within ${ms} ms`);
        // reject before aborting: abort listeners run synchronously, and the
        // operation's own AbortError must not win the race
        reject(new GatewayTimeoutException(EXTERNAL_TIMEOUT_MESSAGE));
        controller.abort();
      }, ms);
    });

    try {
      return await Promise.race([operation(controller.signal), expired]);
    } finally {
      clearTimeout(timer);
    }
  }
}
