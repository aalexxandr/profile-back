import { DocumentBuilder } from '@nestjs/swagger';

export function getSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Portfolio API')
    .setDescription(
      "REST API of the portfolio: the projects (cases) from the author's career. Public endpoints list published cases and return one case in full; the write endpoints (create, update, delete) are not protected yet.",
    )
    .setVersion('1.0.0')
    .addTag(
      'Cases',
      "Projects from the author's career: a compact form for the list page and a full form for the detail page",
    )
    .setContact(
      'Alexandr',
      'https://github.com/aalexxandr',
      'alexxaandr.m@gmail.com',
    )
    .build();
}
