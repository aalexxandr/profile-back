import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    this.logger.error(`Status: ${status} Error: ${message}`);

    response.status(status).json({
      status: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    });
  }
}
