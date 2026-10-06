import { DocumentBuilder } from '@nestjs/swagger';

export function getSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Portfolio API')
    .setVersion('1.0.0')
    .setContact(
      'Alexandr',
      'https://github.com/aalexxandr',
      'alexxaandr.m@gmail.com',
    )
    .build();
}
