import type { Request, Response } from 'express';

import { logger } from './logger.middleware';

describe('logger middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('логирует метод и url и передаёт управление дальше', () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const next = jest.fn();
    const req = { method: 'GET', originalUrl: '/ping?a=1' } as Request;

    logger(req, {} as Response, next);

    expect(log).toHaveBeenCalledWith('Request: [GET] /ping?a=1');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
