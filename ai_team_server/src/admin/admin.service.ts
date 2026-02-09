// src/admin/admin.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  AssignedAgent,
  AssignedGroup,
  AgentGroup,
  User,
  AgentName,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/* ============================================
 * Types
 * ============================================ */

type BaseAssignOpts = {
  /** Optional start time (defaults to now in DB) */
  startsAt?: Date | string;
  /** Optional fixed expiry; if provided it overrides durationDays */
  expiresAt?: Date | string | null;
  /** If set, compute expiresAt = startsAt (or now) + durationDays */
  durationDays?: number | null;
  /** Defaults true in DB */
  isActive?: boolean;
};

type GroupSelector =
  | { groupId: string; groupName?: never }
  | { groupId?: never; groupName: string };

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ListGroupsParams = {
  page?: number;
  limit?: number;
  nameContains?: string;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
};

/* ============================================
 * Service
 * ============================================ */

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) { }

  /* ------------------------------- helpers ------------------------------- */

  private coerceDate(v?: Date | string | null): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return v instanceof Date ? v : new Date(v);
  }

  /** compute expiresAt from startsAt and durationDays, if provided */
  private computeExpiry(
    startsAt?: Date | string,
    expiresAt?: Date | string | null,
    durationDays?: number | null,
  ): { startsAt?: Date; expiresAt?: Date | null } {
    const s = this.coerceDate(startsAt) ?? undefined;
    const e = this.coerceDate(expiresAt);
    if (e !== undefined) {
      // caller explicitly set expiresAt (could be null to clear)
      return { startsAt: s, expiresAt: e };
    }
    if (durationDays && durationDays > 0) {
      const base = s ?? new Date();
      const out = new Date(base);
      out.setDate(out.getDate() + durationDays);
      return { startsAt: s, expiresAt: out };
    }
    return { startsAt: s, expiresAt: undefined };
  }

  /** Fetch user by email; ALWAYS error if not found (no auto-create). */
  private async getUserByEmail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`User with email "${email}" not found`);
    return user;
  }

  /** ensure one active record per (user, agent). If already active, update it; else create */
  private async upsertActiveAssignment(params: {
    userId: string;
    agentName: AgentName;
    startsAt?: Date;
    expiresAt?: Date | null;
    durationDays?: number | null;
    isActive?: boolean;
  }): Promise<AssignedAgent> {
    const { userId, agentName, startsAt, expiresAt, durationDays, isActive } = params;

    const existingActive = await this.prisma.assignedAgent.findFirst({
      where: { userId, agentName, isActive: true },
    });

    if (existingActive) {
      return this.prisma.assignedAgent.update({
        where: { id: existingActive.id },
        data: {
          startsAt: startsAt ?? existingActive.startsAt,
          // if expiresAt is undefined keep current; if null, clear; if Date set new
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(durationDays !== undefined ? { durationDays } : {}),
          ...(typeof isActive === 'boolean' ? { isActive } : {}),
        },
      });
    }

    return this.prisma.assignedAgent.create({
      data: {
        userId,
        agentName,
        ...(startsAt ? { startsAt } : {}), // DB default now()
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(durationDays !== undefined ? { durationDays } : {}),
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });
  }

  /** ensure one active record per (user, group). If already active, update it; else create */
  private async upsertActiveGroupAssignment(params: {
    userId: string;
    groupId: string;
    startsAt?: Date;
    expiresAt?: Date | null;
    durationDays?: number | null;
    isActive?: boolean;
  }): Promise<AssignedGroup> {
    const { userId, groupId, startsAt, expiresAt, durationDays, isActive } = params;

    const existingActive = await this.prisma.assignedGroup.findFirst({
      where: { userId, groupId, isActive: true },
    });

    if (existingActive) {
      return this.prisma.assignedGroup.update({
        where: { id: existingActive.id },
        data: {
          startsAt: startsAt ?? existingActive.startsAt,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(durationDays !== undefined ? { durationDays } : {}),
          ...(typeof isActive === 'boolean' ? { isActive } : {}),
        },
      });
    }

    return this.prisma.assignedGroup.create({
      data: {
        userId,
        groupId,
        ...(startsAt ? { startsAt } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(durationDays !== undefined ? { durationDays } : {}),
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });
  }

  /* --------------------- CRON: auto-expire agents & groups --------------------- */

  /**
   * Runs every minute:
   *  - Deactivates AssignedAgent which have expiresAt <= now
   *  - DELETES AssignedGroup which have expiresAt <= now
   *
   * So if you assign a group with durationDays (or explicit expiresAt),
   * once that time is passed, the group assignment row is removed.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoExpireAssignmentsCron() {
    const now = new Date();

    // 1) AGENT-LEVEL: mark expired as inactive
    const expiredAgents = await this.prisma.assignedAgent.findMany({
      where: {
        isActive: true,
        expiresAt: { not: null, lte: now },
      },
      select: { id: true },
    });

    if (expiredAgents.length) {
      await this.prisma.assignedAgent.updateMany({
        where: { id: { in: expiredAgents.map((a) => a.id) } },
        data: { isActive: false },
      });
      this.logger.debug(`Auto-deactivated ${expiredAgents.length} AssignedAgent records`);
    }

    // 2) GROUP-LEVEL: delete expired group assignments
    const expiredGroups = await this.prisma.assignedGroup.findMany({
      where: {
        isActive: true,
        expiresAt: { not: null, lte: now },
      },
      select: { id: true },
    });

    if (expiredGroups.length) {
      await this.prisma.assignedGroup.deleteMany({
        where: { id: { in: expiredGroups.map((g) => g.id) } },
      });
      this.logger.debug(`Auto-deleted ${expiredGroups.length} AssignedGroup records`);
    }
  }

  /* --------------------------- helper: list group agents --------------------------- */

  async listGroupAgents(groupId: string) {
    const group = await this.prisma.agentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`AgentGroup "${groupId}" not found`);

    const items = await this.prisma.agentGroupItem.findMany({
      where: { groupId },
      select: { agentName: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      group: { id: group.id, name: group.name, isActive: group.isActive },
      agents: items.map((i) => i.agentName),
      count: items.length,
    };
  }

  /* --------------------------- public API (email) -------------------------- */

  /** Assign a single agent to a user by email. */
  async assignAgentByEmail(
    email: string,
    agentName: AgentName,
    opts: BaseAssignOpts = {},
  ): Promise<AssignedAgent> {
    if (!email?.trim()) throw new BadRequestException('email is required');

    const user = await this.getUserByEmail(email.trim());

    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    return this.upsertActiveAssignment({
      userId: user.id,
      agentName,
      startsAt,
      expiresAt,
      durationDays: opts.durationDays ?? undefined,
      isActive: opts.isActive,
    });
  }

  /** Assign multiple agents to a user by email (single transaction). */
  async assignAgentsByEmail(
    email: string,
    agentNames: AgentName[],
    opts: BaseAssignOpts = {},
  ): Promise<AssignedAgent[]> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    if (!Array.isArray(agentNames) || agentNames.length === 0) {
      throw new BadRequestException('agentNames must be a non-empty array');
    }

    const user = await this.getUserByEmail(email.trim());
    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const results: AssignedAgent[] = [];

      for (const agentName of agentNames) {
        const existingActive = await tx.assignedAgent.findFirst({
          where: { userId: user.id, agentName, isActive: true },
        });

        if (existingActive) {
          const updated = await tx.assignedAgent.update({
            where: { id: existingActive.id },
            data: {
              startsAt: startsAt ?? existingActive.startsAt,
              ...(expiresAt !== undefined ? { expiresAt } : {}),
              ...(opts.durationDays !== undefined
                ? { durationDays: opts.durationDays }
                : {}),
              ...(typeof opts.isActive === 'boolean' ? { isActive: opts.isActive } : {}),
            },
          });
          results.push(updated);
        } else {
          const created = await tx.assignedAgent.create({
            data: {
              userId: user.id,
              agentName,
              ...(startsAt ? { startsAt } : {}),
              ...(expiresAt !== undefined ? { expiresAt } : {}),
              ...(opts.durationDays !== undefined
                ? { durationDays: opts.durationDays }
                : {}),
              isActive: typeof opts.isActive === 'boolean' ? opts.isActive : true,
            },
          });
          results.push(created);
        }
      }

      return results;
    });
  }

  /** Deactivate an active assignment for a user by email. */
  async deactivateAgentByEmail(email: string, agentName: AgentName): Promise<AssignedAgent> {
    const user = await this.getUserByEmail(email.trim());
    const existingActive = await this.prisma.assignedAgent.findFirst({
      where: { userId: user.id, agentName, isActive: true },
    });
    if (!existingActive) {
      throw new NotFoundException(`Active assignment for ${agentName} not found for ${email}`);
    }
    return this.prisma.assignedAgent.update({
      where: { id: existingActive.id },
      data: { isActive: false },
    });
  }

  /** List assignments for a user by email. */
  async listAssignmentsByEmail(email: string, activeOnly = false): Promise<AssignedAgent[]> {
    const user = await this.getUserByEmail(email.trim());
    const now = new Date();

    const where: Prisma.AssignedAgentWhereInput = {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
      ...(activeOnly
        ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
        : {}),
    };

    return this.prisma.assignedAgent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get selected (active & not expired) agent names for a user by email. */
  async getSelectedAgentsByEmail(email: string): Promise<AgentName[]> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());

    const now = new Date();
    const rows = await this.prisma.assignedAgent.findMany({
      where: {
        userId: user.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { agentName: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => r.agentName);
  }

  /* --------------------------- GROUP CRUD --------------------------- */

  /** Create a group (optionally ensure unique name). */
  async createAgentGroup(input: {
    name: string;
    description?: string;
    isActive?: boolean;
  }): Promise<AgentGroup> {
    try {
      return await this.prisma.agentGroup.create({
        data: {
          name: input.name.trim(),
          description: input.description,
          isActive: input.isActive ?? true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`AgentGroup name "${input.name}" already exists`);
      }
      throw e;
    }
  }

  /** Update a group by id. */
  async updateAgentGroup(
    id: string,
    input: { name?: string; description?: string; isActive?: boolean },
  ): Promise<AgentGroup> {
    try {
      return await this.prisma.agentGroup.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException(`AgentGroup "${id}" not found`);
      }
      if (e?.code === 'P2002') {
        throw new ConflictException(`AgentGroup name "${input.name}" already exists`);
      }
      throw e;
    }
  }

  /** Delete a group (plus items & assignments) */
  async deleteAgentGroup(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Remove per-user assignments first
        await tx.assignedGroup.deleteMany({ where: { groupId: id } });
        // Remove items
        await tx.agentGroupItem.deleteMany({ where: { groupId: id } });
        // Delete group
        await tx.agentGroup.delete({ where: { id } });
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException(`AgentGroup "${id}" not found`);
      }
      throw e;
    }
  }

  /** List groups with basic filters + pagination. */
  async listAgentGroups(params: ListGroupsParams = {}): Promise<Paginated<AgentGroup>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Prisma.AgentGroupWhereInput = {
      ...(params.nameContains
        ? { name: { contains: params.nameContains, mode: 'insensitive' } }
        : {}),
      ...(typeof params.isActive === 'boolean' ? { isActive: params.isActive } : {}),
    };

    const orderBy: Prisma.AgentGroupOrderByWithRelationInput = {
      [(params.sortBy ?? 'createdAt')]: params.sortOrder ?? 'desc',
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.agentGroup.count({ where }),
      this.prisma.agentGroup.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Get a single group by ID (with agents count). */
  async getAgentGroupById(id: string): Promise<AgentGroup & { agentsCount: number; agents: AgentName[] }> {
    const group = await this.prisma.agentGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException(`AgentGroup "${id}" not found`);

    const items = await this.prisma.agentGroupItem.findMany({
      where: { groupId: id },
      select: { agentName: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...group,
      agentsCount: items.length,
      agents: items.map((i) => i.agentName),
    };
  }

  /** Add agents to a group (deduped, createMany skipDuplicates). */
  async addAgentsToGroup(groupId: string, agentNames: AgentName[]): Promise<{ count: number }> {
    // ensure group exists
    const group = await this.prisma.agentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`AgentGroup "${groupId}" not found`);

    // dedupe incoming
    const unique = Array.from(new Set(agentNames));
    if (unique.length === 0) return { count: 0 };

    const result = await this.prisma.agentGroupItem.createMany({
      data: unique.map((a) => ({ groupId, agentName: a })),
      skipDuplicates: true, // relies on @@unique([groupId, agentName])
    });

    return { count: result.count };
  }

  /** Remove specific agents from a group. */
  async removeAgentsFromGroup(
    groupId: string,
    agentNames: AgentName[],
  ): Promise<{ count: number }> {
    // ensure group exists
    const group = await this.prisma.agentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`AgentGroup "${groupId}" not found`);

    if (!agentNames.length) return { count: 0 };

    const result = await this.prisma.agentGroupItem.deleteMany({
      where: { groupId, agentName: { in: agentNames } },
    });

    return { count: result.count };
  }

  /**
   * Replace a group's agents with the provided set (transactional).
   * Passing an empty array clears the group.
   */
  async replaceGroupAgents(groupId: string, agentNames: AgentName[]): Promise<void> {
    // ensure group exists
    const group = await this.prisma.agentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`AgentGroup "${groupId}" not found`);

    const next = Array.from(new Set(agentNames)); // dedupe

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // delete all not in next
      await tx.agentGroupItem.deleteMany({
        where: {
          groupId,
          ...(next.length ? { agentName: { notIn: next } } : {}),
        },
      });

      if (next.length) {
        // create missing
        await tx.agentGroupItem.createMany({
          data: next.map((a) => ({ groupId, agentName: a })),
          skipDuplicates: true,
        });
      }
    });
  }

  /**
   * Add agents to a group AND assign those agents to a user by email.
   * 1. Adds agents to the group (deduped, idempotent)
   * 2. Assigns those agents to the user
   * 3. Also upserts an AssignedGroup for (user, group)
   */
  async addAgentsToGroupAndAssignByEmail(
    email: string,
    selector: GroupSelector,
    agentNames: AgentName[],
    opts: BaseAssignOpts = {},
  ): Promise<{ addedToGroup: { count: number }; assignments: AssignedAgent[] }> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    if (!Array.isArray(agentNames) || agentNames.length === 0) {
      throw new BadRequestException('agentNames must be a non-empty array');
    }

    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);

    // 1. Add agents to the group (idempotent)
    const addedToGroup = await this.addAgentsToGroup(groupId, agentNames);

    // 2. Compute expiry options
    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    // 3. Upsert AssignedGroup for this user+group
    await this.upsertActiveGroupAssignment({
      userId: user.id,
      groupId,
      startsAt,
      expiresAt,
      durationDays: opts.durationDays ?? undefined,
      isActive: opts.isActive,
    });

    // 4. Assign the agents to the user
    const assignments = await this.assignAgentsByEmail(email.trim(), agentNames, opts);

    return { addedToGroup, assignments };
  }

  /* --------------------------- GROUP-BASED ASSIGN -------------------------- */

  /** Resolve a group by id or unique name and return its id. */
  private async resolveGroupId(sel: GroupSelector): Promise<string> {
    if (sel.groupId) {
      const g = await this.prisma.agentGroup.findUnique({ where: { id: sel.groupId } });
      if (!g) throw new NotFoundException(`AgentGroup with id "${sel.groupId}" not found`);
      return g.id;
    }
    if (sel.groupName) {
      const g = await this.prisma.agentGroup.findUnique({ where: { name: sel.groupName } });
      if (!g) throw new NotFoundException(`AgentGroup with name "${sel.groupName}" not found`);
      return g.id;
    }
    throw new BadRequestException('Provide groupId or groupName');
  }

  /** Fetch AgentName[] members of a group (ordered, deduped). */
  private async getGroupAgentNames(groupId: string): Promise<AgentName[]> {
    const items = await this.prisma.agentGroupItem.findMany({
      where: { groupId },
      select: { agentName: true },
      orderBy: { createdAt: 'asc' },
    });
    if (items.length === 0) {
      throw new BadRequestException(`AgentGroup "${groupId}" has no agents`);
    }
    const seen = new Set<AgentName>();
    const out: AgentName[] = [];
    for (const i of items) {
      if (!seen.has(i.agentName)) {
        seen.add(i.agentName);
        out.push(i.agentName);
      }
    }
    return out;
  }

  /**
   * Assign ALL agents of a given group (by id or name) to a user by email.
   * ALSO UPSERTS an AssignedGroup row for that (user, group).
   */
  async assignAgentGroupByEmail(
    email: string,
    selector: GroupSelector,
    opts: BaseAssignOpts = {},
  ): Promise<AssignedAgent[]> {
    if (!email?.trim()) throw new BadRequestException('email is required');

    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);
    const agentNames = await this.getGroupAgentNames(groupId);

    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    // Ensure an AssignedGroup exists/updates for this user+group
    await this.upsertActiveGroupAssignment({
      userId: user.id,
      groupId,
      startsAt,
      expiresAt,
      durationDays: opts.durationDays ?? undefined,
      isActive: opts.isActive,
    });

    // Materialize per-agent assignments
    return this.assignAgentsByEmail(email.trim(), agentNames, opts);
  }

  /**
   * Assign ALL agents from MULTIPLE groups (by id or name) to a user by email.
   * Groups are merged and deduplicated before assigning.
   * ALSO UPSERTS an AssignedGroup row for EACH provided group.
   */
  async assignAgentGroupsByEmail(
    email: string,
    selectors: GroupSelector[],
    opts: BaseAssignOpts = {},
  ): Promise<AssignedAgent[]> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    if (!Array.isArray(selectors) || selectors.length === 0) {
      throw new BadRequestException('selectors must be a non-empty array of group identifiers');
    }
    const user = await this.getUserByEmail(email.trim());

    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    const merged = new Set<AgentName>();
    for (const sel of selectors) {
      const groupId = await this.resolveGroupId(sel);

      // upsert AssignedGroup for each group in the request
      await this.upsertActiveGroupAssignment({
        userId: user.id,
        groupId,
        startsAt,
        expiresAt,
        durationDays: opts.durationDays ?? undefined,
        isActive: opts.isActive,
      });

      const names = await this.getGroupAgentNames(groupId);
      names.forEach((n) => merged.add(n));
    }

    const agentNames = Array.from(merged);
    if (agentNames.length === 0) {
      throw new BadRequestException('No agents found in the provided groups');
    }

    // reuse existing logic to keep behavior consistent
    return this.assignAgentsByEmail(email, agentNames, opts);
  }

  /* ===================== create group with agents (+ optional assign) ===================== */

  async createAgentGroupWithAgents(input: {
    name: string;
    description?: string;
    isActive?: boolean;
    agentNames: AgentName[];
  }): Promise<{ group: AgentGroup; itemsCount: number }> {
    if (!input?.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    if (!Array.isArray(input.agentNames) || input.agentNames.length === 0) {
      throw new BadRequestException('agentNames must be a non-empty array');
    }

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const group = await tx.agentGroup.create({
          data: {
            name: input.name.trim(),
            description: input.description,
            isActive: input.isActive ?? true,
          },
        });

        const unique = Array.from(new Set(input.agentNames));
        const res = await tx.agentGroupItem.createMany({
          data: unique.map((a) => ({ groupId: group.id, agentName: a })),
          skipDuplicates: true,
        });

        return { group, itemsCount: res.count };
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`AgentGroup name "${input.name}" already exists`);
      }
      throw e;
    }
  }

  async createGroupWithAgentsAndAssignByEmail(
    email: string,
    groupInput: {
      name: string;
      description?: string;
      isActive?: boolean;
      agentNames: AgentName[];
    },
    opts: BaseAssignOpts = {},
  ): Promise<{ group: AgentGroup; assignments: AssignedAgent[] }> {
    if (!email?.trim()) throw new BadRequestException('email is required');

    const { group } = await this.createAgentGroupWithAgents(groupInput);

    // Ensure AssignedGroup row exists too
    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );
    const user = await this.getUserByEmail(email.trim());
    await this.upsertActiveGroupAssignment({
      userId: user.id,
      groupId: group.id,
      startsAt,
      expiresAt,
      durationDays: opts.durationDays ?? undefined,
      isActive: opts.isActive,
    });

    // then assign that group's agents materialized
    const assignments = await this.assignAgentGroupByEmail(
      email.trim(),
      { groupId: group.id },
      opts,
    );

    return { group, assignments };
  }

  /* ===================== GROUP ASSIGNMENT (explicit API) ===================== */

  async assignGroupToUserByEmail(
    email: string,
    selector: GroupSelector,
    opts: BaseAssignOpts = {},
    alsoAssignAgents = true,
  ): Promise<{ groupAssignment: AssignedGroup; agentAssignments?: AssignedAgent[] }> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());

    const groupId = await this.resolveGroupId(selector);
    const { startsAt, expiresAt } = this.computeExpiry(
      opts.startsAt,
      opts.expiresAt,
      opts.durationDays ?? undefined,
    );

    const groupAssignment = await this.upsertActiveGroupAssignment({
      userId: user.id,
      groupId,
      startsAt,
      expiresAt,
      durationDays: opts.durationDays ?? undefined,
      isActive: opts.isActive,
    });

    if (!alsoAssignAgents) return { groupAssignment };

    const agentNames = await this.getGroupAgentNames(groupId);
    const agentAssignments = await this.assignAgentsByEmail(email.trim(), agentNames, opts);

    return { groupAssignment, agentAssignments };
  }

  async listGroupAssignmentsByEmail(
    email: string,
    activeOnly = false,
  ): Promise<
    (AssignedGroup & {
      group: { id: string; name: string; description: string | null; agents: AgentName[] };
    })[]
  > {
    const user = await this.getUserByEmail(email.trim());
    const now = new Date();

    const where: Prisma.AssignedGroupWhereInput = {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
      ...(activeOnly
        ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
        : {}),
    };

    const assignments = await this.prisma.assignedGroup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        group: {
          include: {
            items: {
              select: { agentName: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    // Transform to include agents array
    return assignments.map((a) => ({
      ...a,
      group: {
        id: a.group.id,
        name: a.group.name,
        description: a.group.description,
        agents: a.group.items.map((i) => i.agentName),
      },
    })) as any;
  }

  async deactivateGroupByEmail(
    email: string,
    selector: GroupSelector,
  ): Promise<AssignedGroup> {
    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);
    const existing = await this.prisma.assignedGroup.findFirst({
      where: { userId: user.id, groupId, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException(`Active group assignment not found for ${email}`);
    }
    return this.prisma.assignedGroup.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  /** Admin: permanently delete a GROUP assignment for a user */
  async deleteGroupAssignmentByEmail(
    email: string,
    selector: GroupSelector,
  ): Promise<{ deleted: boolean; id: string }> {
    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);
    const existing = await this.prisma.assignedGroup.findFirst({
      where: { userId: user.id, groupId },
    });
    if (!existing) {
      throw new NotFoundException(`Group assignment not found for ${email}`);
    }
    await this.prisma.assignedGroup.delete({
      where: { id: existing.id },
    });
    return { deleted: true, id: existing.id };
  }

  /** User self-service: update their own GROUP assignment */
  async updateMyGroupAssignmentByEmail(
    email: string,
    selector: GroupSelector,
    updates: {
      startsAt?: Date | string;
      expiresAt?: Date | string | null;
      durationDays?: number | null;
      isActive?: boolean;
    },
  ): Promise<AssignedGroup> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);

    const existing = await this.prisma.assignedGroup.findFirst({
      where: { userId: user.id, groupId },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      throw new NotFoundException('Group assignment not found');
    }

    const { startsAt, expiresAt } = this.computeExpiry(
      updates.startsAt,
      updates.expiresAt,
      updates.durationDays ?? undefined,
    );

    return this.prisma.assignedGroup.update({
      where: { id: existing.id },
      data: {
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(updates.durationDays !== undefined
          ? { durationDays: updates.durationDays }
          : {}),
        ...(typeof updates.isActive === 'boolean' ? { isActive: updates.isActive } : {}),
      },
    });
  }

  /** User self-service: extend (or reduce) their GROUP assignment expiry by N days. */
  async extendMyGroupAssignmentByEmail(
    email: string,
    selector: GroupSelector,
    addDays: number,
  ): Promise<AssignedGroup> {
    if (!Number.isInteger(addDays) || Math.abs(addDays) > 3650) {
      throw new BadRequestException('addDays must be an integer within ±3650');
    }
    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);
    const existing = await this.prisma.assignedGroup.findFirst({
      where: { userId: user.id, groupId },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      throw new NotFoundException('Group assignment not found');
    }

    const base = existing.expiresAt ?? new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + addDays);

    return this.prisma.assignedGroup.update({
      where: { id: existing.id },
      data: { expiresAt: next },
    });
  }

  /** User self-service: deactivate (opt-out) their GROUP assignment. */
  async deactivateMyGroupAssignmentByEmail(
    email: string,
    selector: GroupSelector,
  ): Promise<AssignedGroup> {
    const user = await this.getUserByEmail(email.trim());
    const groupId = await this.resolveGroupId(selector);
    const existing = await this.prisma.assignedGroup.findFirst({
      where: { userId: user.id, groupId, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException('Active group assignment not found');
    }
    return this.prisma.assignedGroup.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  /**
   * Get agents by email, optionally filtered by a specific group.
   * If selector is provided, returns only agents from that group that are assigned to the user.
   * If selector is not provided, returns all active assigned agents for the user.
   */
  async getAgentsByEmailAndGroup(
    email: string,
    selector?: GroupSelector | null,
    activeOnly = true,
  ): Promise<{
    email: string;
    agents: AgentName[];
    group?: { id: string; name: string; description: string | null };
  }> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());
    const now = new Date();

    // If group selector is provided, filter by that group
    if (selector) {
      const groupId = await this.resolveGroupId(selector);
      const group = await this.prisma.agentGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException(`AgentGroup not found`);

      // Get agents in this group
      const groupAgents = await this.prisma.agentGroupItem.findMany({
        where: { groupId },
        select: { agentName: true },
      });
      const groupAgentNames = new Set(groupAgents.map((g) => g.agentName));

      // Get user's assigned agents that are also in this group
      const where: Prisma.AssignedAgentWhereInput = {
        userId: user.id,
        agentName: { in: Array.from(groupAgentNames) },
        ...(activeOnly ? { isActive: true } : {}),
        ...(activeOnly ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}),
      };

      const assignments = await this.prisma.assignedAgent.findMany({
        where,
        select: { agentName: true },
        orderBy: { createdAt: 'desc' },
      });

      return {
        email: user.email,
        agents: assignments.map((a) => a.agentName),
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
        },
      };
    }

    // No group filter - return all assigned agents
    const where: Prisma.AssignedAgentWhereInput = {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
      ...(activeOnly ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}),
    };

    const assignments = await this.prisma.assignedAgent.findMany({
      where,
      select: { agentName: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      email: user.email,
      agents: assignments.map((a) => a.agentName),
    };
  }

  /** Return all user emails as a flat string[] */
  async listAllEmails(): Promise<{ email: string; name: string | null }[]> {
    const rows = await this.prisma.user.findMany({
      select: { email: true, username: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      email: r.email,
      name: r.username ?? null,
    }));
  }
}
