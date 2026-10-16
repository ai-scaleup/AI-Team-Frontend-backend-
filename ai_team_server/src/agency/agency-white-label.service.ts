import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  AgencyCustomerStatus,
  AgencyStatus,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { agencySlug } from './agency-slug';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

const DAY_MS = 86_400_000;
const SESSION_DAYS = 30;
const INVITE_DAYS = 14;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const MIN_PASSWORD = 10;
const MAX_LOGO_CHARS = 300_000; // ~220 KB image as base64
export const SESSION_TOKEN_PREFIX = 'acs_';

const HOST_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/** The platform's own addresses; an agency can never claim these. */
function platformHosts(): Set<string> {
  const configured = process.env.PLATFORM_HOSTS;
  const list = configured?.trim()
    ? configured.split(',')
    : ['ai-team.biz', 'www.ai-team.biz', 'localhost', '127.0.0.1'];
  return new Set(list.map((h) => h.trim().toLowerCase()).filter(Boolean));
}

/** "App.Agency.com:3002" → "app.agency.com". Null when it is not a host name. */
export function normalizeHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  return HOST_RE.test(host) ? host : null;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export type SessionMeta = { ip?: string | null; userAgent?: string | null };

/**
 * Which agency a login page is for: on the AI Team address its id, or its
 * name as in the address (`slug`, see agencySlug); on the agency's own
 * address, that address (`host`).
 */
export type AgencyRef = { host?: unknown; agencyId?: unknown; slug?: unknown };

const AGENCY_SELECT = {
  id: true,
  name: true,
  status: true,
  branding: true,
} as const;

/**
 * An agency customer is a User of their own, separate from any AI Team
 * account with the same email, so nothing (chats, grants, usage) is shared.
 * That User's email is the sign-in email made unique to agency logins:
 * "ann@acme.com" → "ann=acme.com@agency-login.invalid". The customer still
 * signs in with "ann@acme.com". Logins made before this used the plain email
 * as their User's email; those still work.
 */
const IDENTITY_DOMAIN = 'agency-login.invalid';

export function agencyIdentityEmail(loginEmail: string): string {
  const email = loginEmail.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return `${email.slice(0, at)}=${email.slice(at + 1)}@${IDENTITY_DOMAIN}`;
}

/** The email the customer signs in with, from their User's email. */
export function agencyLoginEmail(userEmail: string): string {
  const suffix = `@${IDENTITY_DOMAIN}`;
  if (!userEmail.endsWith(suffix)) return userEmail.toLowerCase();
  const body = userEmail.slice(0, -suffix.length);
  const sep = body.lastIndexOf('=');
  return `${body.slice(0, sep)}@${body.slice(sep + 1)}`.toLowerCase();
}

export type CustomerSession = {
  sessionId: string;
  userId: string;
  oauthId: string;
  /** The customer's own User email (see agencyIdentityEmail). */
  email: string;
  /** The email they sign in with, as the agency added it. */
  loginEmail: string;
  agencyId: string;
};

/**
 * Agency white label and the agency customers' own login.
 *
 * Customers of an agency sign in with a password kept here, not with Clerk:
 * on the agency's sign-in page on the AI Team address
 * (/agency-login/<agencyId>), or on the agency's own address when it has one.
 * They set it through a one-time setup link the agency gives them. A login
 * only works for the agency the customer belongs to, and only while the
 * customer holds a seat there and the agency is not suspended. Nothing is deleted: links are marked used or replaced,
 * sessions are revoked, domains are archived.
 */
@Injectable()
export class AgencyWhiteLabelService {
  constructor(private readonly prisma: PrismaService) {}

  /* ── branding and domains ── */

  /** The live agency a login page is for, or null. An address wins, then an id. */
  private async agencyFor(ref: AgencyRef) {
    if (typeof ref?.host === 'string' && ref.host.trim())
      return this.agencyForHost(ref.host);
    if (ref?.agencyId === undefined && typeof ref?.slug === 'string')
      return this.agencyForSlug(ref.slug);
    if (typeof ref?.agencyId !== 'string' || !UUID_RE.test(ref.agencyId))
      return null;
    return this.prisma.agency.findFirst({
      where: { id: ref.agencyId, archivedAt: null },
      select: AGENCY_SELECT,
    });
  }

  /**
   * The live agency whose name gives this address segment. Names are kept
   * apart by slug (AgencyService.assertNameFree); if older ones still clash,
   * the oldest agency keeps the address.
   */
  private async agencyForSlug(slug: string) {
    const wanted = slug.trim().toLowerCase();
    if (!wanted) return null;
    const live = await this.prisma.agency.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: AGENCY_SELECT,
    });
    return live.find((a) => agencySlug(a.name) === wanted) ?? null;
  }

  /** The live agency an address belongs to, or null. */
  private async agencyForHost(host: unknown) {
    const hostname = normalizeHost(host);
    if (!hostname) return null;
    const domain = await this.prisma.agencyDomain.findFirst({
      where: { hostname, archivedAt: null, agency: { archivedAt: null } },
      select: { agency: { select: AGENCY_SELECT } },
    });
    return domain?.agency ?? null;
  }

  private originCache = new Map<string, { at: number; allowed: boolean }>();

  /** CORS: is this browser origin an agency's live address? Cached a minute. */
  async isAgencyOrigin(origin: string): Promise<boolean> {
    let host: string | null;
    try {
      host = normalizeHost(new URL(origin).host);
    } catch {
      return false;
    }
    if (!host) return false;
    const hit = this.originCache.get(host);
    if (hit && Date.now() - hit.at < 60_000) return hit.allowed;
    const allowed = Boolean(await this.agencyForHost(host));
    this.originCache.set(host, { at: Date.now(), allowed });
    if (this.originCache.size > 1000) this.originCache.clear();
    return allowed;
  }

  /** What an agency's login page shows. Public: nothing private in it. */
  async publicBranding(ref: AgencyRef) {
    const agency = await this.agencyFor(ref);
    if (!agency) throw new NotFoundException('Agency not found');
    return {
      agencyId: agency.id,
      slug: agencySlug(agency.name),
      productName: agency.branding?.productName ?? agency.name,
      logoDataUrl: agency.branding?.logoDataUrl ?? null,
      primaryColor: agency.branding?.primaryColor ?? '#0ea5e9',
      suspended: agency.status === AgencyStatus.SUSPENDED,
    };
  }

  async setBranding(
    agencyId: string,
    data: {
      productName?: unknown;
      logoDataUrl?: unknown;
      primaryColor?: unknown;
    },
    actor: string,
  ) {
    await this.liveAgency(agencyId);
    const productName =
      typeof data?.productName === 'string' ? data.productName.trim() : '';
    if (!productName || productName.length > 60)
      throw new BadRequestException(
        'productName is required (at most 60 characters)',
      );
    const primaryColor =
      typeof data?.primaryColor === 'string' && data.primaryColor.trim()
        ? data.primaryColor.trim()
        : '#0ea5e9';
    if (!COLOR_RE.test(primaryColor))
      throw new BadRequestException('primaryColor must look like #0ea5e9');
    let logoDataUrl: string | null = null;
    if (
      data?.logoDataUrl !== undefined &&
      data.logoDataUrl !== null &&
      data.logoDataUrl !== ''
    ) {
      if (
        typeof data.logoDataUrl !== 'string' ||
        !LOGO_RE.test(data.logoDataUrl)
      )
        throw new BadRequestException(
          'The logo must be a PNG, JPEG, WebP or SVG image',
        );
      if (data.logoDataUrl.length > MAX_LOGO_CHARS)
        throw new BadRequestException(
          'The logo is too large (keep it under 200 KB)',
        );
      logoDataUrl = data.logoDataUrl;
    }

    await this.prisma.$transaction([
      this.prisma.agencyBranding.upsert({
        where: { agencyId },
        create: {
          agencyId,
          productName,
          logoDataUrl,
          primaryColor,
          updatedBy: actor,
        },
        update: { productName, logoDataUrl, primaryColor, updatedBy: actor },
      }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: 'Updated branding',
          target: productName,
        },
      }),
    ]);
  }

  async addDomain(agencyId: string, host: unknown, actor: string) {
    await this.liveAgency(agencyId);
    const hostname = normalizeHost(host);
    if (!hostname || !hostname.includes('.'))
      throw new BadRequestException('Enter an address like app.youragency.com');
    if (platformHosts().has(hostname))
      throw new BadRequestException(`${hostname} is an AI Team address`);
    const clash = await this.prisma.agencyDomain.findFirst({
      where: { hostname, archivedAt: null },
      select: { agencyId: true },
    });
    if (clash)
      throw new ConflictException(
        clash.agencyId === agencyId
          ? `${hostname} is already on this agency`
          : `${hostname} already belongs to another agency`,
      );
    await this.prisma.$transaction([
      this.prisma.agencyDomain.create({
        data: { agencyId, hostname, createdBy: actor },
      }),
      this.prisma.agencyActivity.create({
        data: { agencyId, actor, action: 'Added address', target: hostname },
      }),
    ]);
  }

  async archiveDomain(agencyId: string, domainId: string, actor: string) {
    const domain = await this.prisma.agencyDomain.findFirst({
      where: { id: domainId, agencyId, archivedAt: null },
    });
    if (!domain) throw new NotFoundException('Address not found');
    await this.prisma.$transaction([
      this.prisma.agencyDomain.update({
        where: { id: domainId },
        data: { archivedAt: new Date() },
      }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: 'Removed address',
          target: domain.hostname,
        },
      }),
    ]);
  }

  /** Branding, live addresses and which customers have set a password. */
  async agencyExtras(agencyId: string, customerEmails: string[]) {
    const [branding, domains, logins] = await Promise.all([
      this.prisma.agencyBranding.findUnique({ where: { agencyId } }),
      this.prisma.agencyDomain.findMany({
        where: { agencyId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, hostname: true, createdAt: true },
      }),
      customerEmails.length
        ? this.prisma.user.findMany({
            where: {
              agencyLogin: { isNot: null },
              OR: [
                { email: { in: customerEmails.map(agencyIdentityEmail) } },
                { email: { in: customerEmails, mode: 'insensitive' } },
              ],
            },
            select: { email: true },
          })
        : Promise.resolve([] as { email: string }[]),
    ]);
    return {
      branding: branding
        ? {
            productName: branding.productName,
            logoDataUrl: branding.logoDataUrl,
            primaryColor: branding.primaryColor,
          }
        : null,
      domains,
      emailsWithLogin: new Set(logins.map((l) => agencyLoginEmail(l.email))),
    };
  }

  /* ── setup links ── */

  /**
   * A one-time link for a customer to set (or reset) their password. The code
   * is returned once and only its hash is kept; older links stop working.
   */
  async createLoginLink(agencyId: string, customerId: string, actor: string) {
    await this.liveAgency(agencyId);
    const customer = await this.prisma.agencyCustomer.findFirst({
      where: {
        id: customerId,
        agencyId,
        status: { not: AgencyCustomerStatus.ARCHIVED },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const code = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * DAY_MS);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.agencyLoginInvite.updateMany({
        where: { customerId, usedAt: null, replacedAt: null },
        data: { replacedAt: now },
      }),
      this.prisma.agencyLoginInvite.create({
        data: {
          agencyId,
          customerId,
          codeHash: sha256(code),
          expiresAt,
          createdBy: actor,
        },
      }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: 'Created login link',
          target: customer.company,
        },
      }),
    ]);
    return { code, expiresAt };
  }

  /* ── customer login ── */

  /**
   * Sets the password from a setup link and signs the customer in. Creates
   * the customer's own User row on first use (see agencyIdentityEmail), so
   * an AI Team account with the same email is never touched.
   */
  async setPassword(
    data: { code?: unknown; password?: unknown },
    ref: AgencyRef,
    meta: SessionMeta,
  ) {
    const code = typeof data?.code === 'string' ? data.code.trim() : '';
    const password = typeof data?.password === 'string' ? data.password : '';
    if (!code)
      throw new BadRequestException('The setup link is missing its code');
    if (password.length < MIN_PASSWORD || password.length > 200)
      throw new BadRequestException(
        `Use a password of at least ${MIN_PASSWORD} characters`,
      );

    const agency = await this.agencyFor(ref);
    const invite = await this.prisma.agencyLoginInvite.findUnique({
      where: { codeHash: sha256(code) },
      include: { customer: true },
    });
    const now = new Date();
    if (
      !invite ||
      invite.usedAt ||
      invite.replacedAt ||
      invite.expiresAt <= now ||
      invite.customer.status === AgencyCustomerStatus.ARCHIVED ||
      !agency ||
      agency.id !== invite.agencyId
    )
      throw new BadRequestException(
        'This setup link is not valid any more. Ask your agency for a new one.',
      );
    if (agency.status === AgencyStatus.SUSPENDED)
      throw new ForbiddenException(
        'This service is paused. Please contact your agency.',
      );

    const email = invite.customer.email.toLowerCase();
    const passwordHash = await hashPassword(password);
    const existing = await this.loginFor(email);

    const loginId = await this.prisma.$transaction(async (tx) => {
      let loginId: string;
      if (existing) {
        loginId = existing.id;
        await tx.agencyCustomerLogin.update({
          where: { id: loginId },
          data: {
            passwordHash,
            passwordSetAt: now,
            failedAttempts: 0,
            lockedUntil: null,
          },
        });
        // A reset signs out everywhere else.
        await tx.agencyCustomerSession.updateMany({
          where: { loginId, revokedAt: null },
          data: { revokedAt: now },
        });
      } else {
        loginId = await this.createLogin(tx, {
          email,
          company: invite.customer.company,
          passwordHash,
        });
      }
      await tx.agencyLoginInvite.update({
        where: { id: invite.id },
        data: { usedAt: now },
      });
      await tx.agencyCustomer.update({
        where: { id: invite.customerId },
        data: { status: AgencyCustomerStatus.ACTIVE, lastActiveAt: now },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId: agency.id,
          actor: email,
          action: existing
            ? 'Customer reset password'
            : 'Customer set password',
          target: invite.customer.company,
        },
      });
      return loginId;
    });
    return this.openSession(loginId, agency.id, meta);
  }

  /**
   * Creates an account straight from the agency's sign-in page, with no setup
   * link: only for an email the agency already holds a seat for, and only
   * while that email has no password yet. The email is not verified, so
   * whoever signs up first with it owns the account; a setup link from the
   * agency still resets the password. An AI Team account with the same email
   * is never touched: the customer gets their own User (see setPassword).
   */
  async signUp(
    data: { email?: unknown; password?: unknown },
    ref: AgencyRef,
    meta: SessionMeta,
  ) {
    const email =
      typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data?.password === 'string' ? data.password : '';
    if (!email) throw new BadRequestException('Enter your email');
    if (password.length < MIN_PASSWORD || password.length > 200)
      throw new BadRequestException(
        `Use a password of at least ${MIN_PASSWORD} characters`,
      );

    const agency = await this.agencyFor(ref);
    if (!agency) throw new NotFoundException('Agency not found');
    const customer = await this.liveCustomer(agency.id, email);
    if (!customer)
      throw new ForbiddenException(
        'This email is not on this service yet. Ask your provider to add you.',
      );
    if (agency.status === AgencyStatus.SUSPENDED)
      throw new ForbiddenException(
        'This service is paused. Please contact your agency.',
      );

    if (await this.loginFor(email))
      throw new ConflictException(
        'This email already has an account. Sign in, or ask your provider for a reset link.',
      );

    const passwordHash = await hashPassword(password);
    const now = new Date();
    let loginId: string;
    try {
      loginId = await this.prisma.$transaction(async (tx) => {
        const id = await this.createLogin(tx, {
          email,
          company: customer.company,
          passwordHash,
          lastLoginAt: now,
        });
        await tx.agencyCustomer.update({
          where: { id: customer.id },
          data: { status: AgencyCustomerStatus.ACTIVE, lastActiveAt: now },
        });
        await tx.agencyActivity.create({
          data: {
            agencyId: agency.id,
            actor: email,
            action: 'Customer created account',
            target: customer.company,
          },
        });
        return id;
      });
    } catch (error) {
      // Two sign-ups for the same email at once: the second one loses.
      if ((error as { code?: string })?.code === 'P2002')
        throw new ConflictException(
          'This email already has an account. Sign in, or ask your provider for a reset link.',
        );
      throw error;
    }
    return this.openSession(loginId, agency.id, meta);
  }

  async login(
    data: { email?: unknown; password?: unknown },
    ref: AgencyRef,
    meta: SessionMeta,
  ) {
    const email =
      typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data?.password === 'string' ? data.password : '';
    const wrong = () => new UnauthorizedException('Email or password is wrong');
    if (!email || !password) throw wrong();

    const agency = await this.agencyFor(ref);
    if (!agency) throw new NotFoundException('Agency not found');

    const login = await this.loginFor(email);
    const now = new Date();
    if (login?.lockedUntil && login.lockedUntil > now)
      throw new ForbiddenException(
        'Too many wrong passwords. Try again in a few minutes.',
      );

    const ok = await verifyPassword(
      password,
      login?.passwordHash ?? (await dummyPasswordHash()),
    );
    if (!login || !ok) {
      if (login) {
        const failed = login.failedAttempts + 1;
        await this.prisma.agencyCustomerLogin.update({
          where: { id: login.id },
          data: {
            failedAttempts: failed >= MAX_FAILED_LOGINS ? 0 : failed,
            lockedUntil:
              failed >= MAX_FAILED_LOGINS
                ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
                : null,
          },
        });
      }
      throw wrong();
    }

    const customer = await this.liveCustomer(agency.id, email);
    if (!customer) throw wrong();
    if (agency.status === AgencyStatus.SUSPENDED)
      throw new ForbiddenException(
        'This service is paused. Please contact your agency.',
      );

    await this.prisma.$transaction([
      this.prisma.agencyCustomerLogin.update({
        where: { id: login.id },
        data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now },
      }),
      this.prisma.agencyCustomer.update({
        where: { id: customer.id },
        data: { lastActiveAt: now },
      }),
    ]);
    return this.openSession(login.id, agency.id, meta);
  }

  private async openSession(
    loginId: string,
    agencyId: string,
    meta: SessionMeta,
  ) {
    const token = SESSION_TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await this.prisma.agencyCustomerSession.create({
      data: {
        loginId,
        agencyId,
        tokenHash: sha256(token),
        expiresAt,
        ip: meta.ip?.slice(0, 100) ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
    return { token, expiresAt };
  }

  /**
   * The customer behind a session token, or null. Re-checked on every request:
   * the session is live, the customer still holds a seat in the session's
   * agency and the agency is neither archived nor suspended.
   */
  async validateSession(token: string): Promise<CustomerSession | null> {
    if (!token.startsWith(SESSION_TOKEN_PREFIX)) return null;
    const now = new Date();
    const session = await this.prisma.agencyCustomerSession.findUnique({
      where: { tokenHash: sha256(token) },
      select: {
        id: true,
        agencyId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        agency: { select: { archivedAt: true, status: true } },
        login: {
          select: {
            user: { select: { id: true, oauthId: true, email: true } },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.agency.archivedAt ||
      session.agency.status === AgencyStatus.SUSPENDED
    )
      return null;
    const user = session.login.user;
    const loginEmail = agencyLoginEmail(user.email);
    if (!(await this.liveCustomer(session.agencyId, loginEmail))) return null;
    if (now.getTime() - session.lastUsedAt.getTime() > 5 * 60_000)
      await this.prisma.agencyCustomerSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });
    return {
      sessionId: session.id,
      userId: user.id,
      oauthId: user.oauthId,
      email: user.email,
      loginEmail,
      agencyId: session.agencyId,
    };
  }

  async logout(token: string) {
    if (!token.startsWith(SESSION_TOKEN_PREFIX)) return;
    await this.prisma.agencyCustomerSession.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * The signed-in customer and their agency's branding. `email` is the
   * customer's own User email, which the app uses for its calls so they reach
   * this customer's data only; `loginEmail` is for showing.
   */
  async me(session: CustomerSession) {
    const [customer, agency] = await Promise.all([
      this.liveCustomer(session.agencyId, session.loginEmail),
      this.prisma.agency.findUnique({
        where: { id: session.agencyId },
        select: { id: true, name: true, branding: true },
      }),
    ]);
    return {
      user: {
        id: session.oauthId,
        email: session.email,
        loginEmail: session.loginEmail,
        name: customer?.company ?? session.loginEmail,
      },
      agency: {
        id: session.agencyId,
        productName: agency?.branding?.productName ?? agency?.name ?? '',
        logoDataUrl: agency?.branding?.logoDataUrl ?? null,
        primaryColor: agency?.branding?.primaryColor ?? '#0ea5e9',
      },
    };
  }

  /* ── helpers ── */

  /** The agency login for a sign-in email, or null. AI Team accounts never match. */
  private async loginFor(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        agencyLogin: { isNot: null },
        OR: [
          { email: agencyIdentityEmail(email) },
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { agencyLogin: true },
    });
    return user?.agencyLogin ?? null;
  }

  /** A customer's own User and login (see agencyIdentityEmail). */
  private async createLogin(
    tx: Prisma.TransactionClient,
    input: {
      email: string;
      company: string;
      passwordHash: string;
      lastLoginAt?: Date;
    },
  ): Promise<string> {
    const user = await tx.user.create({
      data: {
        email: agencyIdentityEmail(input.email),
        oauthId: `agency_${randomUUID()}`,
        username: input.company,
      },
    });
    const login = await tx.agencyCustomerLogin.create({
      data: {
        userId: user.id,
        passwordHash: input.passwordHash,
        lastLoginAt: input.lastLoginAt,
      },
    });
    return login.id;
  }

  private async liveAgency(id: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, archivedAt: null },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  private liveCustomer(agencyId: string, email: string) {
    return this.prisma.agencyCustomer.findFirst({
      where: {
        agencyId,
        status: { not: AgencyCustomerStatus.ARCHIVED },
        email: { equals: email, mode: 'insensitive' },
      },
    });
  }
}
