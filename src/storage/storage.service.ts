import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Stored pictures never change under the same key (it carries a content hash). */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** Public objects of the S3 bucket (Selectel): upload, remove, build URLs. */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
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
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
