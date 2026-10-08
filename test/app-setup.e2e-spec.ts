import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

class PingDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }

  @Post()
  create(@Body() dto: PingDto) {
    return { name: dto.name, count: dto.count, type: typeof dto.count };
  }
}

// Проверяет общую настройку `configureApp()` без БД; образец e2e без Prisma.
describe('configureApp (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    app = await createTestApp({ controllers: [PingController] });
    server = app.getHttpServer() as typeof server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('отвечает на обычный запрос', async () => {
    await request(server).get('/ping').expect(200, { ok: true });
  });

  it('преобразует типы в теле запроса (transform)', async () => {
    const res = await request(server)
      .post('/ping')
      .send({ name: 'a', count: 2 })
      .expect(201);

    expect(res.body).toEqual({ name: 'a', count: 2, type: 'number' });
  });

  it('отклоняет лишние поля (forbidNonWhitelisted)', async () => {
    const res = await request(server)
      .post('/ping')
      .send({ name: 'a', count: 1, extra: true })
      .expect(400);

    expect(res.body).toMatchObject({
      status: 400,
      message: ['property extra should not exist'],
    });
  });

  it('возвращает ошибки валидации по полям в формате фильтра', async () => {
    const res = await request(server)
      .post('/ping')
      .send({ name: '', count: 0 })
      .expect(400);

    const body = res.body as { message: string[]; path: string };
    expect(body.path).toBe('/ping');
    expect(body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name'),
        expect.stringContaining('count'),
      ]),
    );
  });

  it('возвращает 404 в формате фильтра для неизвестного маршрута', async () => {
    const res = await request(server).get('/nope').expect(404);

    expect(res.body).toMatchObject({ status: 404, path: '/nope' });
  });

  it('отдаёт Swagger-документ', async () => {
    const res = await request(server).get('/docs-json').expect(200);

    expect(res.body).toMatchObject({ info: { title: 'Portfolio API' } });
  });
});
