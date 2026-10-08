import { Logger } from '@nestjs/common';

// Тише вывод e2e: DEBUG_TESTS=1 возвращает логи приложения.
if (!process.env.DEBUG_TESTS) {
  jest.spyOn(console, 'log').mockImplementation();
  Logger.overrideLogger(false);
}
