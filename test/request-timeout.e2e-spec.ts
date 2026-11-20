import {
  Controller,
  Get,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';

import { REQUEST_TIMEOUT } from '../src/timeout/timeout.constants';
import { TimeoutModule } from '../src/timeout/timeout.module';
import { createTestApp } from './helpers/create-test-app';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Controller('slow')
class SlowController {
  @Get('200')
  async after200ms() {
    await delay(200);
    return { ok: true };
  }

  @Get('10')
  async after10ms() {
    await delay(10);
    return { ok: true };
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Nothing here');
  }
}

// request-timeouts: "Bound the time of an incoming request" (no DB)
describe('request time limit (e2e)', () => {
  async function appWithLimit(limitMs: number) {
    return createTestApp(
      { imports: [TimeoutModule], controllers: [SlowController] },
      undefined,
      [{ provide: REQUEST_TIMEOUT, useValue: limitMs }],
    );
  }

  describe('with a 50 ms limit', () => {
    let app: INestApplication;
    let server: Parameters<typeof request>[0];

    beforeAll(async () => {
      app = await appWithLimit(50);
      server = app.getHttpServer() as typeof server;
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers 503 with the standard body when the handler is too slow', async () => {
      const res = await request(server).get('/slow/200').expect(503);

      expect(res.body).toEqual({
        status: 503,
        message: 'Request timed out',
        timestamp: expect.any(String) as unknown,
        path: '/slow/200',
      });
    });
  });

  describe('with a 200 ms limit', () => {
    let app: INestApplication;
    let server: Parameters<typeof request>[0];

    beforeAll(async () => {
      app = await appWithLimit(200);
      server = app.getHttpServer() as typeof server;
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers normally when the handler finishes in time', async () => {
      await request(server).get('/slow/10').expect(200, { ok: true });
    });

    it('keeps an error raised within the limit', async () => {
      const res = await request(server).get('/slow/missing').expect(404);

      expect(res.body).toMatchObject({ status: 404, message: 'Nothing here' });
    });
  });
});
