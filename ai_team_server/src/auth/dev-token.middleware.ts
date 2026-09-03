// ===================================================
// Development-token middleware (auth/dev-token.middleware.ts)
// The narrow counterpart to AuthMiddleware: it accepts the development token
// from .env (DEV_API_TOKEN) and nothing else — no Clerk JWT. Route groups that
// are called server-to-server apply it on their own controller.
// ===================================================
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  buildDevAuthClaims,
  extractDevToken,
  isDevAuthEnabled,
  isDevToken,
} from './dev-token';

@Injectable()
export class DevTokenMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!isDevAuthEnabled()) {
      throw new UnauthorizedException(
        'Development-token access is turned off: DEV_API_TOKEN is empty.',
      );
    }

    if (!isDevToken(extractDevToken(req))) {
      throw new UnauthorizedException(
        'Send the development token (DEV_API_TOKEN) in the x-dev-token header or as Authorization: Bearer <token>.',
      );
    }

    req.auth = buildDevAuthClaims(req);
    next();
  }
}
