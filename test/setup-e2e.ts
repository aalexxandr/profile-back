import { Logger } from '@nestjs/common';

// Тише вывод e2e: DEBUG_TESTS=1 возвращает логи приложения.
if (!process.env.DEBUG_TESTS) {
  jest.spyOn(console, 'log').mockImplementation();
  Logger.overrideLogger(false);
}

/**
 * Jest runs test code in a separate VM context but exposes Node's native
 * `structuredClone`, which builds its result in the outer realm. Prisma 8 clones
 * column type params with it and then checks them with
 * `Object.getPrototypeOf(x) === Object.prototype`; for outer-realm objects that
 * is false, so the params are dropped (e.g. `pg/enum: typeName must be a
 * string`). Re-implement it so clones are created inside the test realm.
 * Covers what Prisma clones: plain data, arrays, Date, Map and Set.
 */
function cloneInRealm<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneInRealm) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof Map) {
    const out = new Map<unknown, unknown>();
    for (const [k, v] of value as Map<unknown, unknown>) {
      out.set(cloneInRealm(k), cloneInRealm(v));
    }
    return out as T;
  }
  if (value instanceof Set) {
    const out = new Set<unknown>();
    for (const v of value as Set<unknown>) out.add(cloneInRealm(v));
    return out as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = cloneInRealm(v);
    return out as T;
  }
  return value;
}

globalThis.structuredClone = cloneInRealm;
