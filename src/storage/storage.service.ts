import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_TIMEOUT_MS } from '../timeout/timeout.constants';
import { TimeoutService } from '../timeout/timeout.service';
import { IMMUTABLE_CACHE } from './storage.constants';

/**
 * Public objects of the S3 bucket (Selectel): upload, remove, build URLs.
 * Every call is bounded by `STORAGE_TIMEOUT_MS` and answers `504` on expiry.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly timeoutService: TimeoutService,
  ) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.publicBaseUrl = config
      .getOrThrow<string>('S3_PUBLIC_URL')
      .replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      // Selectel accepts path-style addressing, which needs no wildcard DNS.
      forcePathStyle: true,
      // Newer SDK versions add checksum trailers that S3-compatible stores may reject.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: IMMUTABLE_CACHE,
    });
    await this.timeoutService.run(
      (abortSignal) => this.client.send(command, { abortSignal }),
      STORAGE_TIMEOUT_MS,
      'storage',
    );
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.timeoutService.run(
      (abortSignal) => this.client.send(command, { abortSignal }),
      STORAGE_TIMEOUT_MS,
      'storage',
    );
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
