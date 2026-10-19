import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { AdminGuard } from './admin.guard';
import { Public } from './public.decorator';

const TOKEN = 'a-very-long-admin-token-0123456789-abcdef';

class ProtectedController {
  static handle(this: void) {}

  @Public()
  static open(this: void) {}
}

@Public()
class OpenController {
  static handle(this: void) {}
}

interface Route {
  controller: object;
  handler: () => void;
}

const PROTECTED: Route = {
  controller: ProtectedController,
  handler: ProtectedController.handle,
};

function createContext(
  authorization?: string,
  route: Route = PROTECTED,
): ExecutionContext {
  return {
    getHandler: () => route.handler,
    getClass: () => route.controller,
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

/** `ADMIN_TOKEN: undefined` behaves like a variable that is not set. */
function createGuard(env: { ADMIN_TOKEN?: string } = { ADMIN_TOKEN: TOKEN }) {
  const config = {
    getOrThrow: (key: string) => {
      const value = (env as Record<string, string | undefined>)[key];
      if (value === undefined) throw new Error(`${key} is not defined`);
      return value;
    },
  } as unknown as ConfigService;
  return new AdminGuard(config, new Reflector());
}

function rejection(guard: AdminGuard, context: ExecutionContext): unknown {
  try {
    guard.canActivate(context);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = createGuard();
  });

  describe('credentials', () => {
    it('lets a valid Bearer token in', () => {
      expect(guard.canActivate(createContext(`Bearer ${TOKEN}`))).toBe(true);
    });

    it('matches the scheme name case-insensitively', () => {
      expect(guard.canActivate(createContext(`bearer ${TOKEN}`))).toBe(true);
      expect(guard.canActivate(createContext(`BEARER ${TOKEN}`))).toBe(true);
    });

    it.each([
      ['a missing header', undefined],
      ['an empty header', ''],
      ['the Basic scheme', `Basic ${TOKEN}`],
      ['Bearer without a token', 'Bearer'],
      ['Bearer with an empty token', 'Bearer '],
      ['a token without a scheme', TOKEN],
      ['a wrong token', 'Bearer wrong-token'],
      ['a prefix of the token', `Bearer ${TOKEN.slice(0, -1)}`],
      ['the token with extra characters', `Bearer ${TOKEN}x`],
      ['two spaces before the token', `Bearer  ${TOKEN}`],
    ])('rejects %s with 401', (_name, header) => {
      expect(rejection(guard, createContext(header))).toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('gives the same message for every kind of failure', () => {
      const messages = [
        undefined,
        'Bearer wrong-token',
        `Basic ${TOKEN}`,
        'Bearer',
      ].map((header) => {
        const error = rejection(guard, createContext(header));
        return (error as UnauthorizedException).message;
      });

      expect(new Set(messages).size).toBe(1);
    });

    it('does not put the configured token into the error', () => {
      const error = rejection(guard, createContext('Bearer wrong-token'));

      expect(
        JSON.stringify((error as UnauthorizedException).getResponse()),
      ).not.toContain(TOKEN);
    });
  });

  describe('startup', () => {
    it('refuses to start without ADMIN_TOKEN', () => {
      expect(() => createGuard({})).toThrow('ADMIN_TOKEN');
    });

    it.each([
      ['empty', ''],
      ['31 characters long', 'x'.repeat(31)],
    ])('refuses a token that is %s and names the minimum', (_name, value) => {
      expect(() => createGuard({ ADMIN_TOKEN: value })).toThrow(
        /ADMIN_TOKEN.*32/,
      );
    });

    it('never puts a rejected token into the error', () => {
      const secret = 'short-secret-value';

      let message: string | undefined;
      try {
        createGuard({ ADMIN_TOKEN: secret });
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).toBeDefined();
      expect(message).not.toContain(secret);
    });

    it('starts with a token of exactly 32 characters', () => {
      const token = 'x'.repeat(32);
      const exact = createGuard({ ADMIN_TOKEN: token });

      expect(exact.canActivate(createContext(`Bearer ${token}`))).toBe(true);
    });
  });

  describe('@Public()', () => {
    it('lets a public handler in without a header', () => {
      const context = createContext(undefined, {
        controller: ProtectedController,
        handler: ProtectedController.open,
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('lets every handler of a public class in without a header', () => {
      const context = createContext(undefined, {
        controller: OpenController,
        handler: OpenController.handle,
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('keeps a handler without the decorator closed', () => {
      expect(rejection(guard, createContext())).toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
