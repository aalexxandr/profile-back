import { ApiProperty } from '@nestjs/swagger';

/** Error body produced by `AllExceptionFilter` for every failed request. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404, description: 'HTTP status code' })
  status!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Case not found',
    description:
      'Error message; for validation errors (400) a list with one message per invalid field',
  })
  message!: string | string[];

  @ApiProperty({
    example: '2026-10-17T10:15:30.000Z',
    description: 'When the error happened, ISO 8601',
  })
  timestamp!: string;

  @ApiProperty({ example: '/cases/unknown', description: 'Requested URL' })
  path!: string;
}
