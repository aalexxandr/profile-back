import { ConfigService } from '@nestjs/config';
import postgres from '@prisma/orm-postgres/runtime';

import { PrismaService } from './prisma.service';

jest.mock('@prisma/orm-postgres/runtime', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const postgresMock = jest.mocked(postgres);

function createService(uri: string | undefined) {
  const close = jest.fn<Promise<void>, []>().mockResolvedValue();
  const Case = { name: 'Case model' };
  postgresMock.mockReturnValue({
    orm: { public: { Case } },
    close,
  } as unknown as ReturnType<typeof postgres>);

  const getOrThrow = jest.fn((key: string) => {
    if (uri === undefined) throw new Error(`Missing ${key}`);
    return uri;
  });
  const config = { getOrThrow } as unknown as ConfigService;

  return { config, getOrThrow, close, Case };
}

describe('PrismaService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('создаёт клиент с POSTGRES_URI из конфига', () => {
    const { config, getOrThrow } = createService('postgresql://localhost/db');

    new PrismaService(config);

    expect(getOrThrow).toHaveBeenCalledWith('POSTGRES_URI');
    expect(postgresMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'postgresql://localhost/db' }),
    );
  });

  it('бросает ошибку, если POSTGRES_URI не задан', () => {
    const { config } = createService(undefined);

    expect(() => new PrismaService(config)).toThrow('POSTGRES_URI');
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it('отдаёт модель из client.orm.public', () => {
    const { config, Case } = createService('postgresql://localhost/db');

    expect(new PrismaService(config).cases).toBe(Case);
  });

  it('закрывает клиент при остановке модуля', async () => {
    const { config, close } = createService('postgresql://localhost/db');

    await new PrismaService(config).onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
