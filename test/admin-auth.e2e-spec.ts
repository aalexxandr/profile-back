import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { Public } from '../src/auth/public.decorator';
import { adminAuth, TEST_ADMIN_TOKEN } from './helpers/admin-auth';
import { createTestApp } from './helpers/create-test-app';

class NoteDto {
  @IsString()
  @IsNotEmpty()
  title!: string;
}

const uploadHandler = jest.fn<{ received: boolean }, []>(() => ({
  received: true,
}));

// Stub routes: no DB needed, only the global guard is under test.
@Controller('stub')
class StubController {
  @Public()
  @Get('open')
  open() {
    return { open: true };
  }

  @Get('closed')
  closed() {
    return { closed: true };
  }

  @Post('note')
  note(@Body() dto: NoteDto) {
    return { title: dto.title };
  }

  @Put('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() _file: Express.Multer.File | undefined) {
    return uploadHandler();
  }
}

describe('Admin auth (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    app = await createTestApp({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
      controllers: [StubController],
    });
    server = app.getHttpServer() as typeof server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    uploadHandler.mockClear();
  });

  it('serves a @Public() route without a token', async () => {
    await request(server).get('/stub/open').expect(200, { open: true });
  });

  it('closes a route that has no decorator', async () => {
    await request(server).get('/stub/closed').expect(401);
  });

  it('lets the admin token in', async () => {
    await request(server)
      .get('/stub/closed')
      .set(...adminAuth())
      .expect(200, { closed: true });
  });

  it.each([
    ['a wrong token', 'Bearer wrong-token'],
    ['the wrong scheme', `Basic ${TEST_ADMIN_TOKEN}`],
    ['a token without a scheme', TEST_ADMIN_TOKEN],
  ])('rejects %s with 401', async (_name, header) => {
    await request(server)
      .get('/stub/closed')
      .set('Authorization', header)
      .expect(401);
  });

  it('answers 401 in the standard error body, the same for a missing and a wrong token', async () => {
    const missing = await request(server).get('/stub/closed').expect(401);
    const wrong = await request(server)
      .get('/stub/closed')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);

    expect(missing.body).toMatchObject({
      status: 401,
      path: '/stub/closed',
    });
    expect(Object.keys(missing.body as object).sort()).toEqual([
      'message',
      'path',
      'status',
      'timestamp',
    ]);
    expect((wrong.body as { message: string }).message).toBe(
      (missing.body as { message: string }).message,
    );
    expect(JSON.stringify(wrong.body)).not.toContain(TEST_ADMIN_TOKEN);
  });

  it('answers 401, not 400, for an invalid body without a token', async () => {
    await request(server).post('/stub/note').send({ title: '' }).expect(401);
  });

  it('validates the body once the token is accepted', async () => {
    await request(server)
      .post('/stub/note')
      .set(...adminAuth())
      .send({ title: '' })
      .expect(400);
  });

  it('refuses an unauthenticated upload without running the handler', async () => {
    await request(server)
      .put('/stub/upload')
      .attach('file', Buffer.from('payload'), 'photo.jpg')
      .expect(401);

    expect(uploadHandler).not.toHaveBeenCalled();
  });

  it('runs the upload handler for the admin', async () => {
    await request(server)
      .put('/stub/upload')
      .set(...adminAuth())
      .attach('file', Buffer.from('payload'), 'photo.jpg')
      .expect(200, { received: true });

    expect(uploadHandler).toHaveBeenCalledTimes(1);
  });
});
