import { REQUEST_TIMEOUT_MS, STORAGE_TIMEOUT_MS } from './timeout.constants';

describe('timeout constants', () => {
  it('gives the storage less time than the whole request', () => {
    // a stalled storage call must surface as 504 before the request limit turns it into 503
    expect(STORAGE_TIMEOUT_MS).toBeLessThan(REQUEST_TIMEOUT_MS);
  });

  it('uses 30 s for a request and 10 s for the storage', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(STORAGE_TIMEOUT_MS).toBe(10_000);
  });
});
