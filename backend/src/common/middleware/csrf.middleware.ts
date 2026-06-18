import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

interface CookieRequest extends Request {
  cookies: Record<string, string>;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: CookieRequest, res: Response, next: NextFunction) {
    const cookieName = 'csrf-token';
    const headerName = 'x-csrf-token';

    const cookies = req.cookies || {};

    // 1. Generate CSRF token for safe requests if not present
    if (
      req.method === 'GET' ||
      req.method === 'HEAD' ||
      req.method === 'OPTIONS'
    ) {
      let token = cookies[cookieName];
      if (!token) {
        token = randomBytes(24).toString('hex');
        res.cookie(cookieName, token, {
          httpOnly: false, // Client-side JS needs to read it to put it in the header
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
      return next();
    }

    // 2. Validate CSRF token for state-changing requests
    const cookieToken = cookies[cookieName];
    const headerToken = req.headers[headerName] as string;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new HttpException(
        'CSRF token validation failed.',
        HttpStatus.FORBIDDEN,
      );
    }

    next();
  }
}
