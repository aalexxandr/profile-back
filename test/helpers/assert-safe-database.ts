const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * E2E создают и удаляют записи в реальной БД. Бросает ошибку, если
 * POSTGRES_URI указывает не на локальный хост (защита от production).
 * Пустое значение допустимо: это тест без БД.
 */
export function assertSafeDatabase(uri: string | undefined) {
  if (!uri) return;

  let hostname: string;
  try {
    hostname = new URL(uri).hostname;
  } catch {
    throw new Error('E2E отказываются работать: POSTGRES_URI не разобрать.');
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `E2E отказываются работать с БД на хосте "${hostname}": разрешены только локальные базы.`,
    );
  }
}
