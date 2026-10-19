import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { ApiErrorResponse } from './api-error-response.decorator';
import { ADMIN_TOKEN_SCHEME } from './swagger.constants';

/**
 * Marks an operation as admin-only in the document: the bearer scheme plus the
 * `401` response. Put it on every route that is not `@Public()`.
 */
export const ApiAdminAuth = () =>
  applyDecorators(
    ApiBearerAuth(ADMIN_TOKEN_SCHEME),
    ApiErrorResponse(401, 'Missing or invalid admin token'),
  );
