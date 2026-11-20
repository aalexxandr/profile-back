/**
 * Stands in for `StorageService` in tests so that nothing reaches the real
 * bucket: `overrideProvider(StorageService).useValue(new InMemoryStorage())`.
 * Same public surface as the real service, plus `has` / `keys` / `get` to
 * assert what was stored and `failNextPut` to simulate a failing storage.
 */
export class InMemoryStorage {
  private readonly objects = new Map<
    string,
    { body: Buffer; contentType: string }
  >();

  private nextPutError: Error | undefined;

  constructor(private readonly baseUrl = 'https://storage.test') {}

  /** The next `put` rejects with `error` and stores nothing; later ones work again. */
  failNextPut(error: Error): void {
    this.nextPutError = error;
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.nextPutError !== undefined) {
      const error = this.nextPutError;
      this.nextPutError = undefined;
      return Promise.reject(error);
    }
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  get(key: string) {
    return this.objects.get(key);
  }

  keys(): string[] {
    return [...this.objects.keys()];
  }
}
