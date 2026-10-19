/**
 * Токен администратора для e2e. `test/setup-e2e.ts` кладёт его в
 * `process.env.ADMIN_TOKEN`, поэтому `AdminGuard` в тестовом приложении
 * принимает именно его (длина >= 32, как требует приложение).
 */
export const TEST_ADMIN_TOKEN =
  'e2e-admin-token-0123456789abcdef-0123456789abcdef';

/**
 * Заголовок для защищённых запросов: `request(server).post('/cases').set(...adminAuth())`.
 */
export const adminAuth = (): [string, string] => [
  'Authorization',
  `Bearer ${TEST_ADMIN_TOKEN}`,
];
