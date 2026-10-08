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
        ? this.getHttpMessage(exception)
        : 'Internal server error';

    this.logger.error(`Status: ${status} Error: ${JSON.stringify(message)}`);

    response.status(status).json({
      status: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    });
  }

  // ValidationPipe кладёт список ошибок по полям в getResponse().message
  private getHttpMessage(exception: HttpException): string | string[] {
    const body = exception.getResponse();
    if (typeof body === 'object' && 'message' in body) {
      const { message } = body;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.map(String);
    }
    return exception.message;
  }
}
