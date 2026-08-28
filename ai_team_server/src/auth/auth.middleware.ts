// ===================================================
// 1. Authentication Middleware (auth/auth.middleware.ts)
// Verifies the caller and attaches auth claims to the request object.
// The routes listed in public-routes.ts skip this entirely.
// Everywhere else, two credentials are accepted and exactly one is required:
//   * a Clerk JWT sent as `Authorization: Bearer <jwt>`
//   * the development token from .env (DEV_API_TOKEN), sent either as
//     `x-dev-token: <token>` or `Authorization: Bearer <token>`
// ===================================================
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Clerk } from '@clerk/clerk-sdk-node';
import {
  buildDevAuthClaims,
  extractDevToken,
  isDevAuthEnabled,
  isDevToken,
} from './dev-token';
import { isPublicRoute } from './public-routes';

// This extends the Express Request interface to include our 'auth' property
declare global {
  namespace Express {
    interface Request {
      auth?: any;
    }
  }
}

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Public routes — the n8n workflow calls these with no credential.
    if (isPublicRoute(req)) {
      next();
      return;
    }

    // 2. Development token — checked next so it never reaches Clerk.
    const devToken = extractDevToken(req);
    if (isDevToken(devToken)) {
      req.auth = buildDevAuthClaims(req);
      next();
      return;
    }

    // 3. Clerk JWT.
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        isDevAuthEnabled()
          ? 'Provide a Clerk JWT in the Authorization header, or the development token in the x-dev-token header.'
          : 'Bearer token is missing or invalid.',
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      const claims = await clerk.verifyToken(token);
      req.auth = claims; // Attach claims to the request
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
