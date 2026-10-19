/**
 * Stands in for `StorageService` in tests so that nothing reaches the real
 * bucket: `overrideProvider(StorageService).useValue(new InMemoryStorage())`.
 * Same public surface as the real service, plus `has` / `keys` / `get` to
 * assert what was stored.
 */
export class InMemoryStorage {
  private readonly objects = new Map<
    string,
    { body: Buffer; contentType: string }
  >();

  constructor(private readonly baseUrl = 'https://storage.test') {}

  put(key: string, body: Buffer, contentType: string): Promise<void> {
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
