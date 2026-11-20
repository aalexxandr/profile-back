import { GatewayTimeoutException, Logger } from '@nestjs/common';

import { EXTERNAL_TIMEOUT_MESSAGE } from './timeout.constants';
import { TimeoutService } from './timeout.service';

/** An operation that never settles on its own; records the signal it got. */
function stalledOperation() {
  const seen: { signal?: AbortSignal } = {};
  const operation = (signal: AbortSignal) => {
    seen.signal = signal;
    return new Promise<never>(() => undefined);
  };
  return { operation, seen };
}

describe('TimeoutService', () => {
  let service: TimeoutService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new TimeoutService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rejects with 504 and a generic message when the call exceeds its limit', async () => {
    const { operation } = stalledOperation();

    const result = service.run(operation, 50, 'storage');
    jest.advanceTimersByTime(50);

    const error: unknown = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GatewayTimeoutException);
    expect((error as GatewayTimeoutException).getStatus()).toBe(504);
    expect((error as GatewayTimeoutException).message).toBe(
      EXTERNAL_TIMEOUT_MESSAGE,
    );
  });

  it('aborts the pending call on expiry', async () => {
    const { operation, seen } = stalledOperation();

    const result = service.run(operation, 50, 'storage');
    expect(seen.signal?.aborted).toBe(false);
    jest.advanceTimersByTime(50);

    await expect(result).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(seen.signal?.aborted).toBe(true);
  });

  it('does not time out before the limit', async () => {
    const { operation } = stalledOperation();
    const onSettle = jest.fn();

    void service.run(operation, 50, 'storage').then(onSettle, onSettle);
    jest.advanceTimersByTime(49);
    await Promise.resolve();

    expect(onSettle).not.toHaveBeenCalled();
  });

  it('resolves with the value of a call that finishes in time and clears the timer', async () => {
    const operation = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 10));

    const result = service.run(operation, 200, 'storage');
    jest.advanceTimersByTime(10);

    await expect(result).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rethrows an error raised within the limit unchanged', async () => {
    const failure = new Error('S3 is down');

    await expect(
      service.run(() => Promise.reject(failure), 200, 'storage'),
    ).rejects.toBe(failure);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports the timeout even when the call rejects after being aborted', async () => {
    const operation = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      });

    const result = service.run(operation, 50, 'storage');
    jest.advanceTimersByTime(50);

    await expect(result).rejects.toBeInstanceOf(GatewayTimeoutException);
  });
});
