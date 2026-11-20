import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { GatewayTimeoutException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_TIMEOUT_MS } from '../timeout/timeout.constants';
import { TimeoutService } from '../timeout/timeout.service';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn((input: object) => ({ kind: 'put', input })),
  DeleteObjectCommand: jest.fn((input: object) => ({ kind: 'delete', input })),
}));

const S3ClientMock = jest.mocked(S3Client);
const PutObjectCommandMock = jest.mocked(PutObjectCommand);
const DeleteObjectCommandMock = jest.mocked(DeleteObjectCommand);

const ENV: Record<string, string> = {
  S3_ENDPOINT: 'https://s3.example.com',
  S3_REGION: 'ru-1',
  S3_BUCKET: 'portfolio',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_PUBLIC_URL: 'https://cdn.example.com',
};

function createService(env: Record<string, string | undefined> = ENV) {
  const send = jest
    .fn<Promise<unknown>, [unknown, { abortSignal?: AbortSignal }?]>()
    .mockResolvedValue({});
  S3ClientMock.mockImplementation(
    () => ({ send }) as unknown as InstanceType<typeof S3Client>,
  );
  const getOrThrow = jest.fn((key: string) => {
    const value = env[key];
    if (value === undefined) throw new Error(`Missing ${key}`);
    return value;
  });
  const timeoutService = new TimeoutService();
  const run = jest.spyOn(timeoutService, 'run');
  const service = new StorageService(
    { getOrThrow } as unknown as ConfigService,
    timeoutService,
  );
  return { service, send, run };
}

describe('StorageService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('configuration', () => {
    it('builds the S3 client from the environment', () => {
      createService();

      expect(S3ClientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://s3.example.com',
          region: 'ru-1',
          credentials: { accessKeyId: 'access', secretAccessKey: 'secret' },
        }),
      );
    });

    it.each(Object.keys(ENV))('throws when %s is missing', (name) => {
      const env = { ...ENV, [name]: undefined };

      expect(() => createService(env)).toThrow(name);
    });
  });

  describe('publicUrl', () => {
    it('joins the public base URL and the key', () => {
      const { service } = createService();

      expect(service.publicUrl('cases/spectre/ab12.webp')).toBe(
        'https://cdn.example.com/cases/spectre/ab12.webp',
      );
    });

    it('does not double the slash when the base URL ends with one', () => {
      const { service } = createService({
        ...ENV,
        S3_PUBLIC_URL: 'https://cdn.example.com/',
      });

      expect(service.publicUrl('cases/a/b.webp')).toBe(
        'https://cdn.example.com/cases/a/b.webp',
      );
    });
  });

  describe('put', () => {
    it('uploads the bytes as an immutable image/webp object', async () => {
      const { service, send } = createService();
      const body = Buffer.from('webp bytes');

      await service.put('cases/a/b.webp', body, 'image/webp');

      expect(PutObjectCommandMock).toHaveBeenCalledWith({
        Bucket: 'portfolio',
        Key: 'cases/a/b.webp',
        Body: body,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('lets a storage error propagate', async () => {
      const { service, send } = createService();
      const error = new Error('S3 is down');
      send.mockRejectedValue(error);

      await expect(
        service.put('cases/a/b.webp', Buffer.alloc(1), 'image/webp'),
      ).rejects.toBe(error);
    });
  });

  describe('delete', () => {
    it('removes the object by key', async () => {
      const { service, send } = createService();

      await service.delete('cases/a/b.webp');

      expect(DeleteObjectCommandMock).toHaveBeenCalledWith({
        Bucket: 'portfolio',
        Key: 'cases/a/b.webp',
      });
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('time limit', () => {
    it.each([
      ['put', (s: StorageService) => s.put('k', Buffer.alloc(1), 'image/webp')],
      ['delete', (s: StorageService) => s.delete('k')],
    ])(
      '%s runs through TimeoutService with the storage limit and passes its abort signal',
      async (_name, call) => {
        const { service, send, run } = createService();

        await call(service);

        expect(run).toHaveBeenCalledWith(
          expect.any(Function),
          STORAGE_TIMEOUT_MS,
          'storage',
        );
        const options = send.mock.calls[0]?.[1];
        expect(options?.abortSignal).toBeInstanceOf(AbortSignal);
      },
    );

    it('rejects a stalled upload with 504 and aborts the request', async () => {
      jest.useFakeTimers();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const { service, send } = createService();
        send.mockReturnValue(new Promise(() => undefined));

        const result = service.put('k', Buffer.alloc(1), 'image/webp');
        jest.advanceTimersByTime(STORAGE_TIMEOUT_MS);

        await expect(result).rejects.toBeInstanceOf(GatewayTimeoutException);
        expect(send.mock.calls[0]?.[1]?.abortSignal?.aborted).toBe(true);
      } finally {
        jest.useRealTimers();
        jest.restoreAllMocks();
      }
    });
  });
});
