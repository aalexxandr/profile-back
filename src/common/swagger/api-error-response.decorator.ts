import { ApiResponse } from '@nestjs/swagger';

import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Documents an error status with the shared `ErrorResponseDto` body, so
 * controllers do not repeat the schema:
 * `@ApiErrorResponse(404, 'Unknown case')`.
 */
export const ApiErrorResponse = (status: number, description: string) =>
  ApiResponse({ status, description, type: ErrorResponseDto });
