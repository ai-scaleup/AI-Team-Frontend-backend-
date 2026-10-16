import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AgencyRef,
  AgencyWhiteLabelService,
  CustomerSession,
  SESSION_TOKEN_PREFIX,
} from './agency-white-label.service';

/**
 * Attempt limits per 15 minutes, per server instance. Keyed on the agency and
 * email rather than the IP: logins arrive through the Next.js server, so every
 * customer would share one IP. Each login also locks after 5 wrong passwords.
 */
const WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 10_000)
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    return;
  }
  entry.count += 1;
  if (entry.count > max)
    throw new HttpException(
      'Too many attempts. Try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
}

// For the session record only (never for security): the frontend server
// passes the customer's own IP, since the request itself comes from it.
const meta = (req: Request) => ({
  ip:
    (req.headers['x-agency-client-ip'] as string | undefined) ?? req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
});

function bearer(req: Request): string {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

type RefBody = { agencyId?: string; host?: string };

const refOf = (body: RefBody): AgencyRef => ({
  host: body?.host,
  agencyId: body?.agencyId,
});
const refKey = (body: RefBody) =>
  String(body?.host || body?.agencyId).toLowerCase();

/**
 * Login for agency customers — no Clerk. The frontend says which agency the
 * login page is for: `agencyId` on the AI Team address
 * (/agency-login/<agencyId>), or `host` on the agency's own address.
 * branding, login and set-password are public routes; logout and me need the
 * session token (AuthMiddleware checks it).
 */
@ApiTags('Agency customer login')
@Controller('agency-auth')
export class AgencyAuthController {
  constructor(private readonly service: AgencyWhiteLabelService) {}

  @Get('branding')
  @ApiOperation({
    summary: "An agency's branding for its login page (public)",
  })
  @ApiQuery({ name: 'agency', required: false, description: 'Agency id' })
  @ApiQuery({
    name: 'slug',
    required: false,
    description: 'Agency name as in its address',
    example: 'rossi-dental-clinic',
  })
  @ApiQuery({ name: 'host', required: false, example: 'app.youragency.com' })
  branding(
    @Query('agency') agencyId?: string,
    @Query('slug') slug?: string,
    @Query('host') host?: string,
  ) {
    return this.service.publicBranding({ host, agencyId, slug });
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password (public)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        agencyId: { type: 'string' },
        host: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
      },
    },
  })
  login(
    @Body() body: RefBody & { email?: string; password?: string },
    @Req() req: Request,
  ) {
    rateLimit(
      `login:${refKey(body)}:${String(body?.email).trim().toLowerCase()}`,
      20,
    );
    return this.service.login(body, refOf(body), meta(req));
  }

  @Post('sign-up')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Create an account for an email the agency already added as a customer (public)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        agencyId: { type: 'string' },
        host: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
      },
    },
  })
  signUp(
    @Body() body: RefBody & { email?: string; password?: string },
    @Req() req: Request,
  ) {
    rateLimit(`sign-up:${refKey(body)}`, 30);
    return this.service.signUp(body, refOf(body), meta(req));
  }

  @Post('set-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set or reset the password from a setup link (public)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'password'],
      properties: {
        agencyId: { type: 'string' },
        host: { type: 'string' },
        code: { type: 'string' },
        password: { type: 'string' },
      },
    },
  })
  setPassword(
    @Body() body: RefBody & { code?: string; password?: string },
    @Req() req: Request,
  ) {
    rateLimit(`set-password:${refKey(body)}`, 60);
    return this.service.setPassword(body, refOf(body), meta(req));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'End this session' })
  async logout(@Req() req: Request) {
    const token = bearer(req);
    if (token.startsWith(SESSION_TOKEN_PREFIX))
      await this.service.logout(token);
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in agency customer and their branding' })
  me(@Req() req: Request) {
    const session = (
      req.auth as { agencySession?: CustomerSession } | undefined
    )?.agencySession;
    if (!session)
      throw new UnauthorizedException('Not signed in as an agency customer');
    return this.service.me(session);
  }
}
