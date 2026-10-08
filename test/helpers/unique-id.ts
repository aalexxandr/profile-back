import { randomUUID } from 'node:crypto';

/**
 * Уникальное значение для тестовых данных (slug, имя), чтобы повторные
 * и параллельные прогоны не конфликтовали. Учитывайте лимит длины поля.
 */
export function uniqueId(prefix = 'e2e', maxLength = 20) {
  return `${prefix}-${randomUUID().replaceAll('-', '')}`.slice(0, maxLength);
}
