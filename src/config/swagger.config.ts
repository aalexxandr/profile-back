import { DocumentBuilder } from '@nestjs/swagger';

import { ADMIN_TOKEN_SCHEME } from '../common/swagger/swagger.constants';

export function getSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Portfolio API')
    .setDescription(
      "REST API of the portfolio: the projects (cases) from the author's career. Public endpoints list published cases and return one case in full. The write endpoints (create, update, delete, picture upload and removal) are for the administrator only and need the header `Authorization: Bearer <ADMIN_TOKEN>`; without a valid token they answer 401.",
    )
    .setVersion('1.0.0')
    .addTag(
      'Cases',
      "Projects from the author's career: a compact form for the list page and a full form for the detail page",
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'The administrator token: the value of the `ADMIN_TOKEN` environment variable of the server. Send it as `Authorization: Bearer <token>`.',
      },
      ADMIN_TOKEN_SCHEME,
    )
    .setContact(
      'Alexandr',
      'https://github.com/aalexxandr',
      'alexxaandr.m@gmail.com',
    )
    .build();
}
