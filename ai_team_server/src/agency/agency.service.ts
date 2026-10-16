import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgencyCustomerStatus,
  AgencyStaffRole,
  AgencyStatus,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AgencyWhiteLabelService } from './agency-white-label.service';
import { agencySlug, slugProblem } from './agency-slug';

const CYCLE_MS = 30 * 86_400_000;
const DAY_MS = 86_400_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CreateAgencyDto {
  name!: string;
  ownerName!: string;
  ownerEmail!: string;
  country?: string;
  /** The first seat pool. */
  agencyMembershipId!: string;
  seats!: number;
  /** YYYY-MM-DD; defaults to today. */
  validFrom?: string;
  /** YYYY-MM-DD, inclusive. */
  validUntil!: string;
  note?: string;
}

export class UpdateAgencyDto {
  name?: string;
  ownerName?: string;
  ownerEmail?: string;
  country?: string | null;
  status?: AgencyStatus;
}

export class AddPoolDto {
  agencyMembershipId!: string;
  seats!: number;
  validFrom?: string;
  validUntil!: string;
  note?: string;
}

export class UpdatePoolDto {
  validUntil!: string;
}

export class AdjustSeatsDto {
  /** Positive grants seats, negative removes them. Never 0. */
  change!: number;
  reason!: string;
  note?: string;
}

export class ActivateCustomerDto {
  company!: string;
  email!: string;
  poolId!: string;
  /** true = INVITED (not signed in yet), false = ACTIVE. */
  invite?: boolean;
}

export class SubstituteCustomerDto {
  company!: string;
  email!: string;
  /** Platform-admin override for a second swap in one cycle. */
  override?: boolean;
}

export class InviteStaffDto {
  name!: string;
  email!: string;
  role!: AgencyStaffRole;
}

const poolInclude = {
  membership: {
    select: {
      id: true,
      name: true,
      includedAgents: true,
      monthlyTokenLimit: true,
      includedTeams: {
        orderBy: { createdAt: 'asc' },
        select: { team: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.AgencySeatPoolInclude;

const agencyInclude = {
  pools: {
    where: { archivedAt: null },
    orderBy: { createdAt: 'asc' },
    include: poolInclude,
  },
  customers: { orderBy: { createdAt: 'desc' } },
  staff: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AgencyInclude;

type AgencyRow = Prisma.AgencyGetPayload<{ include: typeof agencyInclude }>;
type PoolRow = AgencyRow['pools'][number];
type CustomerRow = AgencyRow['customers'][number];
type LedgerRow = Prisma.AgencySeatLedgerEntryGetPayload<object>;
type ActivityRow = Prisma.AgencyActivityGetPayload<object>;
type Tx = Prisma.TransactionClient;

/** Start of the 30-day cycle `now` falls in, counted from `cycleStartsAt`. */
export function currentCycleStart(cycleStartsAt: Date, now = new Date()) {
  const elapsed = Math.max(0, now.getTime() - cycleStartsAt.getTime());
  return new Date(
    cycleStartsAt.getTime() + Math.floor(elapsed / CYCLE_MS) * CYCLE_MS,
  );
}

const isLive = (c: { status: AgencyCustomerStatus }) =>
  c.status !== AgencyCustomerStatus.ARCHIVED;

function poolView(pool: PoolRow, customers: CustomerRow[]) {
  const m = pool.membership;
  return {
    id: pool.id,
    agencyMembershipId: m.id,
    membership: m.name,
    // Teams first, then single agents — the labels the membership list shows.
    agents: [...m.includedTeams.map((t) => t.team.name), ...m.includedAgents],
    monthlyTokenLimit: m.monthlyTokenLimit,
    seats: pool.seats,
    inUse: customers.filter((c) => c.poolId === pool.id && isLive(c)).length,
    validFrom: pool.validFrom,
    validUntil: pool.validUntil,
  };
}

function customerView(c: CustomerRow, now = new Date()) {
  const cycleStart = currentCycleStart(c.cycleStartsAt, now);
  return {
    id: c.id,
    poolId: c.poolId,
    company: c.company,
    email: c.email,
    status: c.status,
    // Stays 0 until seats are wired into chat access.
    usedTokens: c.usedTokens,
    cycleStartsAt: cycleStart,
    lastActiveAt: c.lastActiveAt,
    swappedThisCycle: !!c.swappedInAt && c.swappedInAt >= cycleStart,
    archivedAt: c.archivedAt,
  };
}

function agencyView(row: AgencyRow) {
  const now = new Date();
  return {
    id: row.id,
    name: row.name,
    slug: agencySlug(row.name),
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    country: row.country,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    pools: row.pools.map((p) => poolView(p, row.customers)),
    customers: row.customers.map((c) => customerView(c, now)),
    staff: row.staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
    })),
  };
}

export type AgencyView = ReturnType<typeof agencyView>;
export type AgencyDetailView = Omit<AgencyView, 'customers'> & {
  customers: (AgencyView['customers'][number] & { hasLogin: boolean })[];
  ledger: LedgerRow[];
  activity: ActivityRow[];
  branding: {
    productName: string;
    logoDataUrl: string | null;
    primaryColor: string;
  } | null;
  domains: { id: string; hostname: string; createdAt: Date }[];
};

/* ── input helpers ── */

function requiredText(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException(`${label} is required`);
  return text;
}

function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function email(value: unknown, label: string): string {
  const text = requiredText(value, label).toLowerCase();
  if (!EMAIL_RE.test(text))
    throw new BadRequestException(`${label} is not a valid email`);
  return text;
}

function positiveInt(value: unknown, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1)
    throw new BadRequestException(
      `${label} must be a whole number of at least 1`,
    );
  return n;
}

/** YYYY-MM-DD → that day at 00:00 UTC. */
function day(value: unknown, label: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException(`${label} must be a date (YYYY-MM-DD)`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${label} is not a valid date`);
  return date;
}

function today(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** validUntil is inclusive: the pool runs through the whole of that day. */
const poolExpired = (validUntil: Date, now = new Date()) =>
  now.getTime() >= validUntil.getTime() + DAY_MS;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Agencies, their seat pools, seat ledger, customers, staff and activity log.
 *
 * Records only: nothing here gives a customer chat access yet. Nothing is
 * ever deleted — rows are archived, and the ledger and activity log only
 * grow. Every change writes an activity line in the same transaction.
 */
@Injectable()
export class AgencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whiteLabel: AgencyWhiteLabelService,
  ) {}

  /* ── reads ── */

  async list(): Promise<AgencyView[]> {
    const rows = await this.prisma.agency.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: agencyInclude,
    });
    return rows.map(agencyView);
  }

  async get(id: string): Promise<AgencyDetailView> {
    const row = await this.prisma.agency.findFirst({
      where: { id, archivedAt: null },
      include: {
        ...agencyInclude,
        ledger: { orderBy: { createdAt: 'asc' } },
        activity: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Agency not found');
    const { ledger, activity } = row;
    const view = agencyView(row);
    const extras = await this.whiteLabel.agencyExtras(
      id,
      view.customers.map((c) => c.email),
    );
    return {
      ...view,
      customers: view.customers.map((c) => ({
        ...c,
        hasLogin: extras.emailsWithLogin.has(c.email.toLowerCase()),
      })),
      ledger,
      activity,
      branding: extras.branding,
      domains: extras.domains,
    };
  }

  /* ── agency ── */

  async create(data: CreateAgencyDto, actor: string) {
    const name = requiredText(data?.name, 'name');
    const ownerName = requiredText(data?.ownerName, 'ownerName');
    const ownerEmail = email(data?.ownerEmail, 'ownerEmail');
    const country = optionalText(data?.country);
    const seats = positiveInt(data?.seats, 'seats');
    const validFrom = data?.validFrom
      ? day(data.validFrom, 'validFrom')
      : today();
    const validUntil = day(data?.validUntil, 'validUntil');
    if (validUntil < validFrom)
      throw new BadRequestException('validUntil must not be before validFrom');
    const note = optionalText(data?.note);
    const membership = await this.liveMembership(data?.agencyMembershipId);

    await this.assertNameFree(name);

    const id = await this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: { name, ownerName, ownerEmail, country, createdBy: actor },
      });
      const pool = await tx.agencySeatPool.create({
        data: {
          agencyId: agency.id,
          agencyMembershipId: membership.id,
          seats,
          validFrom,
          validUntil,
        },
      });
      await tx.agencySeatLedgerEntry.create({
        data: {
          agencyId: agency.id,
          poolId: pool.id,
          change: seats,
          reason: 'Prepaid pack granted',
          note,
          createdBy: actor,
        },
      });
      await tx.agencyStaff.create({
        data: {
          agencyId: agency.id,
          name: ownerName,
          email: ownerEmail,
          role: AgencyStaffRole.OWNER,
        },
      });
      await tx.agencyActivity.createMany({
        data: [
          {
            agencyId: agency.id,
            actor,
            action: 'Created agency',
            target: name,
          },
          {
            agencyId: agency.id,
            actor,
            action: `Granted seats ${signed(seats)}`,
            target: `${membership.name} pool`,
          },
        ],
      });
      return agency.id;
    });
    return this.get(id);
  }

  async update(id: string, data: UpdateAgencyDto, actor: string) {
    const current = await this.liveAgency(id);
    const patch: Prisma.AgencyUpdateInput = {};
    const changes: string[] = [];

    if (data?.name !== undefined) {
      const name = requiredText(data.name, 'name');
      if (name !== current.name) {
        await this.assertNameFree(name, id);
        patch.name = name;
        changes.push(`Renamed ${current.name} → ${name}`);
      }
    }
    if (data?.ownerName !== undefined) {
      const ownerName = requiredText(data.ownerName, 'ownerName');
      if (ownerName !== current.ownerName) {
        patch.ownerName = ownerName;
        changes.push(`Owner name → ${ownerName}`);
      }
    }
    if (data?.ownerEmail !== undefined) {
      const ownerEmail = email(data.ownerEmail, 'ownerEmail');
      if (ownerEmail !== current.ownerEmail) {
        patch.ownerEmail = ownerEmail;
        changes.push(`Owner email → ${ownerEmail}`);
      }
    }
    if (data?.country !== undefined) {
      const country = optionalText(data.country);
      if (country !== current.country) {
        patch.country = country;
        changes.push(`Country → ${country ?? '—'}`);
      }
    }
    if (data?.status !== undefined) {
      if (!Object.values(AgencyStatus).includes(data.status))
        throw new BadRequestException(
          'status must be ACTIVE, GRACE or SUSPENDED',
        );
      if (data.status !== current.status) {
        patch.status = data.status;
        changes.push(`Status ${current.status} → ${data.status}`);
      }
    }

    if (changes.length) {
      await this.prisma.$transaction([
        this.prisma.agency.update({ where: { id }, data: patch }),
        this.prisma.agencyActivity.createMany({
          data: changes.map((action) => ({
            agencyId: id,
            actor,
            action,
            target: (patch.name as string | undefined) ?? current.name,
          })),
        }),
      ]);
    }
    return this.get(id);
  }

  /** Hides the agency; every row stays. Refused while customers hold seats. */
  async archive(id: string, actor: string) {
    const current = await this.liveAgency(id);
    const live = await this.prisma.agencyCustomer.count({
      where: { agencyId: id, status: { not: AgencyCustomerStatus.ARCHIVED } },
    });
    if (live)
      throw new ConflictException(
        `${live} customer(s) still hold seats. Deactivate them first.`,
      );
    const archivedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.agency.update({ where: { id }, data: { archivedAt } }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId: id,
          actor,
          action: 'Archived agency',
          target: current.name,
        },
      }),
    ]);
    return { id, archivedAt };
  }

  /* ── seat pools ── */

  async addPool(agencyId: string, data: AddPoolDto, actor: string) {
    await this.liveAgency(agencyId);
    const membership = await this.liveMembership(data?.agencyMembershipId);
    const seats = positiveInt(data?.seats, 'seats');
    const validFrom = data?.validFrom
      ? day(data.validFrom, 'validFrom')
      : today();
    const validUntil = day(data?.validUntil, 'validUntil');
    if (validUntil < validFrom)
      throw new BadRequestException('validUntil must not be before validFrom');
    const note = optionalText(data?.note);

    await this.prisma.$transaction(async (tx) => {
      const pool = await tx.agencySeatPool.create({
        data: {
          agencyId,
          agencyMembershipId: membership.id,
          seats,
          validFrom,
          validUntil,
        },
      });
      await tx.agencySeatLedgerEntry.create({
        data: {
          agencyId,
          poolId: pool.id,
          change: seats,
          reason: 'Prepaid pack granted',
          note,
          createdBy: actor,
        },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: `Added seat pool (${seats} seats)`,
          target: `${membership.name} pool`,
        },
      });
    });
    return this.get(agencyId);
  }

  async updatePool(
    agencyId: string,
    poolId: string,
    data: UpdatePoolDto,
    actor: string,
  ) {
    const pool = await this.livePool(agencyId, poolId);
    const validUntil = day(data?.validUntil, 'validUntil');
    if (validUntil < pool.validFrom)
      throw new BadRequestException('validUntil must not be before validFrom');
    if (validUntil.getTime() !== pool.validUntil.getTime()) {
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      await this.prisma.$transaction([
        this.prisma.agencySeatPool.update({
          where: { id: poolId },
          data: { validUntil },
        }),
        this.prisma.agencyActivity.create({
          data: {
            agencyId,
            actor,
            action: `Valid until ${fmt(pool.validUntil)} → ${fmt(validUntil)}`,
            target: `${pool.membership.name} pool`,
          },
        }),
      ]);
    }
    return this.get(agencyId);
  }

  async adjustSeats(
    agencyId: string,
    poolId: string,
    data: AdjustSeatsDto,
    actor: string,
  ) {
    const change =
      typeof data?.change === 'string' ? Number(data.change) : data?.change;
    if (typeof change !== 'number' || !Number.isInteger(change) || change === 0)
      throw new BadRequestException('change must be a non-zero whole number');
    const reason = requiredText(data?.reason, 'reason');
    const note = optionalText(data?.note);
    const pool = await this.livePool(agencyId, poolId);

    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockPool(tx, poolId);
      const after = locked.seats + change;
      if (change < 0) {
        const inUse = await this.seatsInUse(tx, poolId);
        if (after < inUse)
          throw new ConflictException(
            `Refused: ${inUse} seats are in use, so the pool cannot drop to ${after}. Deactivate ${inUse - after} customer(s) first.`,
          );
      }
      await tx.agencySeatPool.update({
        where: { id: poolId },
        data: { seats: { increment: change } },
      });
      await tx.agencySeatLedgerEntry.create({
        data: { agencyId, poolId, change, reason, note, createdBy: actor },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: `${change > 0 ? 'Granted' : 'Removed'} seats ${signed(change)}`,
          target: `${pool.membership.name} pool`,
        },
      });
    });
    return this.get(agencyId);
  }

  /* ── customers ── */

  async activateCustomer(
    agencyId: string,
    data: ActivateCustomerDto,
    actor: string,
  ) {
    const agency = await this.liveAgency(agencyId);
    this.assertNotSuspended(agency.status);
    const company = requiredText(data?.company, 'company');
    const customerEmail = email(data?.email, 'email');
    const pool = await this.livePool(
      agencyId,
      requiredText(data?.poolId, 'poolId'),
    );
    if (poolExpired(pool.validUntil))
      throw new ConflictException(
        `The ${pool.membership.name} pool has expired`,
      );
    const invite = data?.invite === true;

    await this.prisma.$transaction(async (tx) => {
      await this.assertEmailFree(tx, agencyId, customerEmail);
      await this.assertSeatFree(tx, pool.id, pool.membership.name);
      await tx.agencyCustomer.create({
        data: {
          agencyId,
          poolId: pool.id,
          company,
          email: customerEmail,
          status: invite
            ? AgencyCustomerStatus.INVITED
            : AgencyCustomerStatus.ACTIVE,
        },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: invite ? 'Invited customer' : 'Activated customer',
          target: company,
        },
      });
    });
    return this.get(agencyId);
  }

  async deactivateCustomer(
    agencyId: string,
    customerId: string,
    actor: string,
  ) {
    const customer = await this.liveCustomer(agencyId, customerId);
    await this.prisma.$transaction([
      this.prisma.agencyCustomer.update({
        where: { id: customer.id },
        data: { status: AgencyCustomerStatus.ARCHIVED, archivedAt: new Date() },
      }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: 'Deactivated customer',
          target: customer.company,
        },
      }),
    ]);
    return this.get(agencyId);
  }

  async restoreCustomer(agencyId: string, customerId: string, actor: string) {
    const agency = await this.liveAgency(agencyId);
    this.assertNotSuspended(agency.status);
    const customer = await this.prisma.agencyCustomer.findFirst({
      where: { id: customerId, agencyId },
      include: {
        pool: { include: { membership: { select: { name: true } } } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== AgencyCustomerStatus.ARCHIVED)
      throw new ConflictException(`${customer.company} is not archived`);
    if (customer.pool.archivedAt || poolExpired(customer.pool.validUntil))
      throw new ConflictException(
        `The ${customer.pool.membership.name} pool has expired`,
      );

    await this.prisma.$transaction(async (tx) => {
      await this.assertEmailFree(tx, agencyId, customer.email);
      await this.assertSeatFree(
        tx,
        customer.poolId,
        customer.pool.membership.name,
      );
      await tx.agencyCustomer.update({
        where: { id: customer.id },
        data: { status: AgencyCustomerStatus.ACTIVE, archivedAt: null },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: 'Restored customer',
          target: customer.company,
        },
      });
    });
    return this.get(agencyId);
  }

  /**
   * Archives one customer and puts another on the same seat. The 30-day
   * token cycle belongs to the seat, so the incoming customer inherits it.
   * One swap per seat per cycle unless a platform admin overrides.
   */
  async substituteCustomer(
    agencyId: string,
    customerId: string,
    data: SubstituteCustomerDto,
    actor: string,
  ) {
    const agency = await this.liveAgency(agencyId);
    this.assertNotSuspended(agency.status);
    const outgoing = await this.liveCustomer(agencyId, customerId);
    const company = requiredText(data?.company, 'company');
    const incomingEmail = email(data?.email, 'email');
    const override = data?.override === true;
    const now = new Date();
    const cycleStart = currentCycleStart(outgoing.cycleStartsAt, now);
    const swappedThisCycle =
      !!outgoing.swappedInAt && outgoing.swappedInAt >= cycleStart;
    if (swappedThisCycle && !override)
      throw new ConflictException(
        'This seat was already swapped this cycle. One swap per seat per cycle.',
      );

    await this.prisma.$transaction(async (tx) => {
      await this.lockPool(tx, outgoing.poolId);
      if (incomingEmail !== outgoing.email)
        await this.assertEmailFree(tx, agencyId, incomingEmail);
      await tx.agencyCustomer.update({
        where: { id: outgoing.id },
        data: { status: AgencyCustomerStatus.ARCHIVED, archivedAt: now },
      });
      await tx.agencyCustomer.create({
        data: {
          agencyId,
          poolId: outgoing.poolId,
          company,
          email: incomingEmail,
          status: AgencyCustomerStatus.INVITED,
          cycleStartsAt: cycleStart,
          usedTokens: outgoing.usedTokens,
          swappedInAt: now,
          replacesId: outgoing.id,
        },
      });
      await tx.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: override
            ? 'Substituted customer (admin override)'
            : 'Substituted customer',
          target: `${outgoing.company} → ${company}`,
        },
      });
    });
    return this.get(agencyId);
  }

  /* ── staff ── */

  async inviteStaff(agencyId: string, data: InviteStaffDto, actor: string) {
    await this.liveAgency(agencyId);
    const name = requiredText(data?.name, 'name');
    const staffEmail = email(data?.email, 'email');
    const role = data?.role;
    if (
      role !== AgencyStaffRole.MANAGER &&
      role !== AgencyStaffRole.OPERATOR &&
      role !== AgencyStaffRole.VIEWER
    )
      throw new BadRequestException('role must be MANAGER, OPERATOR or VIEWER');
    const clash = await this.prisma.agencyStaff.findFirst({
      where: {
        agencyId,
        archivedAt: null,
        email: { equals: staffEmail, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (clash)
      throw new ConflictException(
        `${staffEmail} is already on this agency's staff`,
      );

    await this.prisma.$transaction([
      this.prisma.agencyStaff.create({
        data: { agencyId, name, email: staffEmail, role },
      }),
      this.prisma.agencyActivity.create({
        data: {
          agencyId,
          actor,
          action: `Invited staff (${role.toLowerCase()})`,
          target: staffEmail,
        },
      }),
    ]);
    return this.get(agencyId);
  }

  /* ── agency portal ── */

  /**
   * The agencies `email` may open in the portal, with its role in each. A
   * platform admin may open every agency, as owner, for support.
   */
  async portalAgencies(email: string, isPlatformAdmin: boolean) {
    const staff = await this.prisma.agencyStaff.findMany({
      where: {
        archivedAt: null,
        email: { equals: email, mode: 'insensitive' },
        agency: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { role: true, agency: { select: { id: true, name: true } } },
    });
    const list = staff.map((s) => ({
      id: s.agency.id,
      name: s.agency.name,
      role: s.role,
      viaAdmin: false,
    }));
    if (isPlatformAdmin) {
      const all = await this.prisma.agency.findMany({
        where: { archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      for (const a of all)
        if (!list.some((x) => x.id === a.id))
          list.push({ ...a, role: AgencyStaffRole.OWNER, viaAdmin: true });
    }
    return list;
  }

  /** The caller's role in this agency, or null when they are not on its staff. */
  async portalMember(
    agencyId: string,
    email: string,
    isPlatformAdmin: boolean,
  ): Promise<{ name: string; email: string; role: AgencyStaffRole } | null> {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, archivedAt: null },
      select: {
        staff: {
          where: {
            archivedAt: null,
            email: { equals: email, mode: 'insensitive' },
          },
          select: { name: true, email: true, role: true },
          take: 1,
        },
      },
    });
    if (!agency) return null;
    if (agency.staff[0]) return agency.staff[0];
    if (isPlatformAdmin)
      return { name: email, email, role: AgencyStaffRole.OWNER };
    return null;
  }

  /**
   * An agency asks AI Team for more seats. Logged in the activity log, which
   * the superadmin sees on the agency; AI Team grants them with Adjust seats.
   */
  async requestSeats(
    agencyId: string,
    data: { poolId?: string; seats?: number; message?: string },
    actor: string,
  ) {
    const pool = await this.livePool(
      agencyId,
      requiredText(data?.poolId, 'poolId'),
    );
    const seats = positiveInt(data?.seats, 'seats');
    const message = optionalText(data?.message);
    await this.prisma.agencyActivity.create({
      data: {
        agencyId,
        actor,
        action: `Requested +${seats} seats`,
        target: `${pool.membership.name} pool${message ? ` — “${message.slice(0, 300)}”` : ''}`,
      },
    });
    return this.get(agencyId);
  }

  /* ── guards ── */

  private async liveAgency(id: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, archivedAt: null },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  private async liveMembership(id: unknown) {
    const membershipId = requiredText(id, 'agencyMembershipId');
    const membership = await this.prisma.agencyMembership.findFirst({
      where: { id: membershipId, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!membership) throw new NotFoundException('Agency membership not found');
    return membership;
  }

  private async livePool(agencyId: string, poolId: string) {
    const pool = await this.prisma.agencySeatPool.findFirst({
      where: { id: poolId, agencyId, archivedAt: null },
      include: { membership: { select: { name: true } } },
    });
    if (!pool) throw new NotFoundException('Seat pool not found');
    return pool;
  }

  private async liveCustomer(agencyId: string, customerId: string) {
    const customer = await this.prisma.agencyCustomer.findFirst({
      where: {
        id: customerId,
        agencyId,
        status: { not: AgencyCustomerStatus.ARCHIVED },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private assertNotSuspended(status: AgencyStatus) {
    if (status === AgencyStatus.SUSPENDED)
      throw new ConflictException('The agency is suspended');
  }

  /** Row lock so two requests cannot both take the last seat. */
  private async lockPool(tx: Tx, poolId: string) {
    const rows = await tx.$queryRaw<{ seats: number }[]>`
      SELECT "seats" FROM "AgencySeatPool" WHERE "id" = ${poolId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Seat pool not found');
    return rows[0];
  }

  private seatsInUse(tx: Tx, poolId: string) {
    return tx.agencyCustomer.count({
      where: { poolId, status: { not: AgencyCustomerStatus.ARCHIVED } },
    });
  }

  private async assertSeatFree(tx: Tx, poolId: string, membershipName: string) {
    const { seats } = await this.lockPool(tx, poolId);
    const inUse = await this.seatsInUse(tx, poolId);
    if (inUse >= seats)
      throw new ConflictException(
        `The ${membershipName} pool is full (${inUse}/${seats}). Add seats or deactivate a customer first.`,
      );
  }

  /**
   * A name must give a free address (see agencySlug): "Rossi Dental" and
   * "rossi-dental" would both be /rossi-dental, so they clash.
   */
  private async assertNameFree(name: string, exceptId?: string) {
    const problem = slugProblem(name);
    if (problem) throw new BadRequestException(problem);
    const slug = agencySlug(name);
    const live = await this.prisma.agency.findMany({
      where: {
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { name: true },
    });
    const clash = live.find((a) => agencySlug(a.name) === slug);
    if (clash)
      throw new ConflictException(
        `"${name}" is too close to the agency "${clash.name}" (both would be /${slug})`,
      );
  }

  /** One live seat per email inside an agency. */
  private async assertEmailFree(
    tx: Tx,
    agencyId: string,
    customerEmail: string,
  ) {
    const clash = await tx.agencyCustomer.findFirst({
      where: {
        agencyId,
        status: { not: AgencyCustomerStatus.ARCHIVED },
        email: { equals: customerEmail, mode: 'insensitive' },
      },
      select: { company: true },
    });
    if (clash)
      throw new ConflictException(
        `${customerEmail} already holds a seat in this agency (${clash.company})`,
      );
  }
}
