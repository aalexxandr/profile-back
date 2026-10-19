import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  digestToken,
  extractBearerToken,
  isSameToken,
} from './admin-token.util';
import {
  ADMIN_TOKEN_ENV,
  IS_PUBLIC_KEY,
  MIN_ADMIN_TOKEN_LENGTH,
} from './auth.constants';

/**
 * Global guard: every route needs `Authorization: Bearer <ADMIN_TOKEN>` unless
 * it is marked `@Public()`. All failures look the same (401).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(
    config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const token = config.getOrThrow<string>(ADMIN_TOKEN_ENV);
    if (token.length < MIN_ADMIN_TOKEN_LENGTH) {
      throw new Error(
        `${ADMIN_TOKEN_ENV} must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters long`,
      );
    }
    this.expected = digestToken(token);
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const { headers } = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(headers.authorization);

    if (token === undefined || !isSameToken(token, this.expected)) {
      throw new UnauthorizedException('Invalid or missing admin token');
    }
    return true;
  }
}
