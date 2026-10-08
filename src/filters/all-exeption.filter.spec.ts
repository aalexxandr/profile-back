import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AllExceptionFilter } from './all-exeption.filter';

function createHost(url = '/some/path') {
  const json = jest.fn<void, [unknown]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionFilter', () => {
  let filter: AllExceptionFilter;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    filter = new AllExceptionFilter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('сохраняет статус и сообщение HttpException', () => {
    const { host, status, json } = createHost('/items/x');

    filter.catch(new NotFoundException('Not here'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      status: 404,
      message: 'Not here',
      timestamp: expect.any(String) as string,
      path: '/items/x',
    });
  });

  it('отдаёт в timestamp дату в формате ISO', () => {
    const { host, json } = createHost();

    filter.catch(new NotFoundException(), host);

    const body = json.mock.calls[0]?.[0] as { timestamp: string };
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('пробрасывает список ошибок валидации', () => {
    const { host, json } = createHost();
    const messages = ['name must be a string', 'count should not be empty'];

    filter.catch(new BadRequestException(messages), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: messages }),
    );
  });

  it('скрывает текст внутренней ошибки и возвращает 500', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('secret db password'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('возвращает 500, если выброшено не Error', () => {
    const { host, status } = createHost();

    filter.catch('just a string', host);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('пишет ошибку в лог', () => {
    const { host } = createHost();

    filter.catch(new NotFoundException('Not here'), host);

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('404'));
  });
});
