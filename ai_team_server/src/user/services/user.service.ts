import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentName, Prisma, User } from 'src/generated/prisma/client';

import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from '../schemas/user.schema';
import { PrismaService } from 'src/prisma/prisma.service';

type DailyUsageItem = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type AssignedLimitSnapshot = {
  agents?: {
    agentName?: string;
    monthlyTokenLimit?: number | null;
  }[];
  teams?: {
    tokenLimit?: number | null;
    team?: {
      agents?: { agentName?: string }[];
    } | null;
  }[];
  memberships?: {
    monthlyTokenLimit?: number | null;
    template?: {
      monthlyTokenLimit?: number | null;
      includedAgents?: string[] | null;
      includedTeams?: {
        team?: {
          agents?: { agentName?: string }[] | null;
          isActive?: boolean;
        } | null;
      }[] | null;
    } | null;
  }[];
  tokenUsage?: {
    agentName?: string;
    totalTokenLimit?: number | null;
  }[];
};

/**
 * What the list needs of every matched user (not only the current page) to
 * sort and summarise: the assignment shapes read by getAssignedLimitTokens
 * and the duration sort, plus usage and conversation-limit aggregates.
 */
type ListSnapshot = {
  memberships: {
    monthlyTokenLimit: number | null;
    template: {
      durationDays: number;
      monthlyTokenLimit: number;
      includedAgents: string[];
      includedTeams: {
        team: { isActive: boolean; agents: { agentName: string }[] };
      }[];
    };
  }[];
  teams: {
    durationDays: number | null;
    tokenLimit: number | null;
    team: { agents: { agentName: string }[] };
  }[];
  agents: {
    agentName: string;
    durationDays: number | null;
    tokenLimit: number | null;
  }[];
  tokenUsage: { agentName: string; totalTokenLimit: number }[];
  /** Usage in the requested range; undefined when the user has none. */
  rangeUsage?: UsageTotals;
  /** Usage in the window the usage sort reads; undefined when none. */
  sortUsage?: UsageTotals;
  conversationLimits: {
    conversations: number;
    withLimit: number;
    minLimit: number | null;
    maxLimit: number | null;
  };
};

type UsageWindow = { from: Date; to: Date };

/** The UTC calendar day Prisma compares a DateTime against a @db.Date column with. */
const utcDay = (value: Date) => value.toISOString().slice(0, 10);

const sumDailyUsage = (items: DailyUsageItem[]) =>
  items.reduce(
    (totals, item) => {
      const inputTokens = item.inputTokens ?? 0;
      const outputTokens = item.outputTokens ?? 0;
      const totalTokens = item.totalTokens || inputTokens + outputTokens;

      return {
        inputTokens: totals.inputTokens + inputTokens,
        outputTokens: totals.outputTokens + outputTokens,
        totalTokens: totals.totalTokens + totalTokens,
      };
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  );

const getAssignedLimitTokens = (user: AssignedLimitSnapshot) => {
  const tokenLimitByAgent = new Map(
    (user.tokenUsage ?? [])
      .filter((item) => item.agentName)
      .map((item) => [String(item.agentName), item.totalTokenLimit ?? 0]),
  );
  const coveredAgentNames = new Set<string>();
  let total = 0;

  (user.agents ?? []).forEach((assignment) => {
    if (!assignment.agentName) return;
    const agentName = String(assignment.agentName);
    coveredAgentNames.add(agentName);
    total += assignment.monthlyTokenLimit ?? tokenLimitByAgent.get(agentName) ?? 0;
  });

  (user.teams ?? []).forEach((assignment) => {
    total += assignment.tokenLimit ?? 0;
    assignment.team?.agents?.forEach((item) => {
      if (item.agentName) coveredAgentNames.add(String(item.agentName));
    });
  });

  (user.memberships ?? []).forEach((assignment) => {
    total +=
      assignment.monthlyTokenLimit ??
      assignment.template?.monthlyTokenLimit ??
      0;
    assignment.template?.includedAgents?.forEach((agentName) => {
      coveredAgentNames.add(String(agentName));
    });
    assignment.template?.includedTeams?.forEach((link) => {
      if (link.team?.isActive === false) return;
      link.team?.agents?.forEach((item) => {
        if (item.agentName) coveredAgentNames.add(String(item.agentName));
      });
    });
  });

  (user.tokenUsage ?? []).forEach((usage) => {
    if (!usage.agentName || coveredAgentNames.has(String(usage.agentName))) return;
    total += usage.totalTokenLimit ?? 0;
  });

  return total;
};

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Create a new user
  async createUser(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // Get users with pagination
  async findAllUsers(query: ListUsersQueryDto) {
    const {
      page: requestedPage,
      limit,
      search,
      usageFrom,
      usageTo,
      membership,
      status,
      sortBy,
      sortDir,
    } = query;
    const searchTerm = search?.trim();
    const defaultUsageFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const requestedUsageFrom = usageFrom ?? defaultUsageFrom;
    const requestedUsageTo = usageTo ?? new Date();
    const rangeStart =
      requestedUsageFrom <= requestedUsageTo
        ? requestedUsageFrom
        : requestedUsageTo;
    const rangeEnd =
      requestedUsageFrom <= requestedUsageTo
        ? requestedUsageTo
        : requestedUsageFrom;
    const normalizedAgentSearch = searchTerm
      ?.toUpperCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    const matchingAgents = normalizedAgentSearch
      ? Object.values(AgentName).filter((agentName) =>
          agentName.includes(normalizedAgentSearch),
        )
      : [];
    const searchWhere: Prisma.UserWhereInput | undefined = searchTerm
      ? {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { username: { contains: searchTerm, mode: 'insensitive' } },
            {
              teams: {
                some: {
                  team: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              memberships: {
                some: {
                  template: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            ...(matchingAgents.length
              ? [
                  { agents: { some: { agentName: { in: matchingAgents } } } },
                  {
                    teams: {
                      some: {
                        team: {
                          agents: {
                            some: { agentName: { in: matchingAgents } },
                          },
                        },
                      },
                    },
                  },
                  {
                    memberships: {
                      some: {
                        template: {
                          OR: [
                            { includedAgents: { hasSome: matchingAgents } },
                            {
                              includedTeams: {
                                some: {
                                  team: {
                                    agents: {
                                      some: { agentName: { in: matchingAgents } },
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : undefined;

    const membershipWhere: Prisma.UserWhereInput | undefined = membership
      ? membership.toLowerCase() === 'none'
        ? { memberships: { none: { isActive: true } } }
        : {
            memberships: {
              some: {
                isActive: true,
                template: {
                  name: { equals: membership, mode: 'insensitive' },
                },
              },
            },
          }
      : undefined;

    // A user counts as having access beyond `boundary` when any assignment
    // (membership, team, or agent) is active and not expired by then.
    const now = new Date();
    const expiringBoundary = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const hasAccessBeyond = (boundary: Date): Prisma.UserWhereInput => {
      const live = {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: boundary } }],
      };
      return {
        OR: [
          { memberships: { some: live } },
          { teams: { some: live } },
          { agents: { some: live } },
        ],
      };
    };
    const statusWhere: Prisma.UserWhereInput | undefined =
      status === 'active'
        ? hasAccessBeyond(expiringBoundary)
        : status === 'expiring'
          ? {
              AND: [
                hasAccessBeyond(now),
                { NOT: hasAccessBeyond(expiringBoundary) },
              ],
            }
          : status === 'expired'
            ? { NOT: hasAccessBeyond(now) }
            : undefined;

    const filters = [searchWhere, membershipWhere, statusWhere].filter(
      (item): item is Prisma.UserWhereInput => Boolean(item),
    );
    const where: Prisma.UserWhereInput | undefined =
      filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]
          : { AND: filters };

    // Resolve the full filtered set first (ids only) so sorting and the
    // usage summary cover every matching user, not just the current page.
    const matchedRows = await this.prisma.user.findMany({
      where,
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = matchedRows.length;
    const totalPages = Math.ceil(total / limit);
    // Clamp so a stale page (e.g. after filters shrink the set) still
    // returns the last page instead of an empty one.
    const page = Math.min(requestedPage, Math.max(totalPages, 1));
    const skip = (page - 1) * limit;

    const todayUtc = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const weekStart = new Date(todayUtc);
    weekStart.setUTCDate(todayUtc.getUTCDate() - 6);
    const laterDate = (a: Date, b: Date) => (a >= b ? a : b);
    const sortFrom =
      sortBy === 'monthly'
        ? rangeStart
        : sortBy === 'weekly'
          ? laterDate(rangeStart, weekStart)
          : sortBy === 'daily'
            ? laterDate(rangeStart, todayUtc)
            : undefined;

    const snapshots = await this.loadListSnapshots(
      matchedRows.map((user) => user.id),
      { from: rangeStart, to: rangeEnd },
      sortFrom && { from: sortFrom, to: rangeEnd },
    );
    const matched = matchedRows.map((user) => ({
      ...user,
      ...snapshots.get(user.id)!,
    }));

    const monthlyTotals = new Map(
      matched.flatMap((user) =>
        user.rangeUsage ? [[user.id, user.rangeUsage] as const] : [],
      ),
    );
    const usageSortTotals =
      sortBy === 'monthly' || sortBy === 'weekly' || sortBy === 'daily'
        ? new Map(
            matched.flatMap((user) =>
              user.sortUsage ? [[user.id, user.sortUsage] as const] : [],
            ),
          )
        : undefined;

    const durationOf = (user: ListSnapshot) =>
      user.memberships[0]?.template?.durationDays ??
      user.teams[0]?.durationDays ??
      user.agents[0]?.durationDays ??
      0;

    const direction = sortDir === 'asc' ? 1 : -1;
    const sorted = [...matched].sort((a, b) => {
      const aValue = usageSortTotals
        ? (usageSortTotals.get(a.id)?.totalTokens ?? 0)
        : sortBy === 'duration'
          ? durationOf(a)
          : a.createdAt.getTime();
      const bValue = usageSortTotals
        ? (usageSortTotals.get(b.id)?.totalTokens ?? 0)
        : sortBy === 'duration'
          ? durationOf(b)
          : b.createdAt.getTime();
      if (aValue !== bValue) return (aValue - bValue) * direction;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const pageIds = sorted.slice(skip, skip + limit).map((user) => user.id);
    const pageUsers = await this.prisma.user.findMany({
      where: { id: { in: pageIds } },
      include: {
        agents: true,
        teams: {
          where: { isActive: true },
          include: { team: { include: { agents: true } } },
        },
        memberships: { include: { template: true } },
        tokenUsage: true,
        dailyUsage: {
          where: {
            date: {
              gte: rangeStart,
              lte: rangeEnd,
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });
    const usersById = new Map(pageUsers.map((user) => [user.id, user]));
    const users = pageIds
      .map((id) => usersById.get(id))
      .filter((user): user is (typeof pageUsers)[number] => Boolean(user));

    let summaryMonthlyTokens = 0;
    let summaryMonthlyInputTokens = 0;
    let summaryMonthlyOutputTokens = 0;
    const summaryAssignedLimitTokens = matched.reduce(
      (sum, user) => sum + getAssignedLimitTokens(user),
      0,
    );
    monthlyTotals.forEach((tokens) => {
      summaryMonthlyTokens += tokens.totalTokens;
      summaryMonthlyInputTokens += tokens.inputTokens;
      summaryMonthlyOutputTokens += tokens.outputTokens;
    });

    return {
      data: users.map((user) => {
        const now = new Date();
        const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
        const weekStart = new Date(today);
        weekStart.setUTCDate(today.getUTCDate() - 6);
        const monthlyUsage = sumDailyUsage(user.dailyUsage);
        const weeklyUsage = sumDailyUsage(
          user.dailyUsage.filter((item) => item.date >= weekStart),
        );
        const dailyUsage = sumDailyUsage(
          user.dailyUsage.filter((item) => item.date >= today),
        );

        const limits = snapshots.get(user.id)?.conversationLimits;
        const conversations = limits?.conversations ?? 0;
        const withLimit = limits?.withLimit ?? 0;
        // A single reportable limit only exists when every conversation carries
        // it; anything else is reported as mixed so the caller does not show a
        // limit that only part of the chats actually has.
        const isUniform =
          conversations > 0 &&
          withLimit === conversations &&
          limits?.minLimit === limits?.maxLimit;
        const uniformLimit = isUniform ? (limits?.minLimit ?? null) : null;

        return {
          ...user,
          conversationTokenLimit: {
            conversations,
            withLimit,
            // The limit stored on the user is the one new conversations
            // inherit, so it is what this row reports — including for a user
            // who has no chats yet, where there is nothing to aggregate. The
            // per-conversation aggregate is only a fallback for limits set
            // directly on conversations, before any user-level assignment.
            tokenLimit: user.tokenLimit ?? uniformLimit,
            mixed: withLimit > 0 && !isUniform,
          },
          usage: {
            monthly: monthlyUsage.totalTokens,
            monthlyInputTokens: monthlyUsage.inputTokens,
            monthlyOutputTokens: monthlyUsage.outputTokens,
            weekly: weeklyUsage.totalTokens,
            weeklyInputTokens: weeklyUsage.inputTokens,
            weeklyOutputTokens: weeklyUsage.outputTokens,
            daily: dailyUsage.totalTokens,
            dailyInputTokens: dailyUsage.inputTokens,
            dailyOutputTokens: dailyUsage.outputTokens,
          },
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        summary: {
          // Monthly token total across ALL filtered users, not just this page.
          monthlyTokens: summaryMonthlyTokens,
          monthlyInputTokens: summaryMonthlyInputTokens,
          monthlyOutputTokens: summaryMonthlyOutputTokens,
          assignedLimitTokens: summaryAssignedLimitTokens,
        },
      },
    };
  }

  /**
   * The list's per-user sort and summary inputs for every matched user in ONE
   * round trip. Loading the same nesting through Prisma relations costs a
   * query per relation level, each a full round trip to the database.
   *
   * `sort` is a sub-window of `range` that ends with it (the weekly or daily
   * usage sort); pass undefined when the sort does not read usage. Day
   * boundaries match Prisma's: a DateTime compared with the @db.Date column
   * is cut to its UTC day.
   */
  private async loadListSnapshots(
    userIds: string[],
    range: UsageWindow,
    sort: UsageWindow | undefined,
  ): Promise<Map<string, ListSnapshot>> {
    if (userIds.length === 0) return new Map();

    const rangeFrom = utcDay(range.from);
    const rangeTo = utcDay(range.to);
    // An empty window (e.g. a weekly sort over last month) sums to nothing.
    const sortFrom = sort && sort.from <= sort.to ? utcDay(sort.from) : null;

    const rows = await this.prisma.$queryRaw<
      (Omit<ListSnapshot, 'rangeUsage' | 'sortUsage' | 'conversationLimits'> & {
        id: string;
        rangeRows: number;
        rangeInput: number;
        rangeOutput: number;
        rangeTotal: number;
        sortRows: number;
        sortInput: number;
        sortOutput: number;
        sortTotal: number;
        conversations: number;
        withLimit: number;
        minLimit: number | null;
        maxLimit: number | null;
      })[]
    >`
      SELECT
        u."id",
        COALESCE((
          SELECT json_agg(json_build_object(
            'monthlyTokenLimit', am."monthlyTokenLimit",
            'template', json_build_object(
              'durationDays', mt."durationDays",
              'monthlyTokenLimit', mt."monthlyTokenLimit",
              'includedAgents', mt."includedAgents",
              'includedTeams', COALESCE((
                SELECT json_agg(json_build_object('team', json_build_object(
                  'isActive', t."isActive",
                  'agents', COALESCE((
                    SELECT json_agg(json_build_object('agentName', ta."agentName"))
                    FROM "AgentTeamAgent" ta WHERE ta."teamId" = t."id"
                  ), '[]'::json)
                )))
                FROM "MembershipTemplateTeam" mtt
                JOIN "AgentTeam" t ON t."id" = mtt."teamId"
                WHERE mtt."membershipTemplateId" = mt."id"
              ), '[]'::json)
            )
          ))
          FROM "AssignedMembership" am
          JOIN "MembershipTemplate" mt ON mt."id" = am."membershipTemplateId"
          WHERE am."userId" = u."id" AND am."isActive"
        ), '[]'::json) AS "memberships",
        COALESCE((
          SELECT json_agg(json_build_object(
            'durationDays', at."durationDays",
            'tokenLimit', at."tokenLimit",
            'team', json_build_object('agents', COALESCE((
              SELECT json_agg(json_build_object('agentName', ta."agentName"))
              FROM "AgentTeamAgent" ta WHERE ta."teamId" = at."teamId"
            ), '[]'::json))
          ))
          FROM "AssignedTeam" at
          WHERE at."userId" = u."id" AND at."isActive"
        ), '[]'::json) AS "teams",
        COALESCE((
          SELECT json_agg(json_build_object(
            'agentName', sa."agentName",
            'durationDays', sa."durationDays",
            'tokenLimit', sa."tokenLimit"
          ))
          FROM "SingleAssignedAgent" sa
          WHERE sa."userId" = u."id" AND sa."isActive"
        ), '[]'::json) AS "agents",
        COALESCE((
          SELECT json_agg(json_build_object(
            'agentName', tu."agentName",
            'totalTokenLimit', tu."totalTokenLimit"
          ))
          FROM "UserAgentTokenUsage" tu
          WHERE tu."oauthId" = u."oauthId"
        ), '[]'::json) AS "tokenUsage",
        usage."rangeRows", usage."rangeInput", usage."rangeOutput", usage."rangeTotal",
        usage."sortRows", usage."sortInput", usage."sortOutput", usage."sortTotal",
        conv."conversations", conv."withLimit", conv."minLimit", conv."maxLimit"
      FROM "User" u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS "rangeRows",
          COALESCE(SUM(d."inputTokens"), 0)::float8 AS "rangeInput",
          COALESCE(SUM(d."outputTokens"), 0)::float8 AS "rangeOutput",
          COALESCE(SUM(d."totalTokens"), 0)::float8 AS "rangeTotal",
          COUNT(*) FILTER (WHERE d."date" >= ${sortFrom}::date)::int AS "sortRows",
          COALESCE(SUM(d."inputTokens") FILTER (WHERE d."date" >= ${sortFrom}::date), 0)::float8 AS "sortInput",
          COALESCE(SUM(d."outputTokens") FILTER (WHERE d."date" >= ${sortFrom}::date), 0)::float8 AS "sortOutput",
          COALESCE(SUM(d."totalTokens") FILTER (WHERE d."date" >= ${sortFrom}::date), 0)::float8 AS "sortTotal"
        FROM "DailyTokenUsage" d
        WHERE d."oauthId" = u."oauthId"
          AND d."date" >= ${rangeFrom}::date
          AND d."date" <= ${rangeTo}::date
      ) usage ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS "conversations",
          COUNT(c."tokenLimit")::int AS "withLimit",
          MIN(c."tokenLimit") AS "minLimit",
          MAX(c."tokenLimit") AS "maxLimit"
        FROM "Conversation" c
        WHERE c."userId" = u."id"
      ) conv ON true
      WHERE u."id" = ANY(${userIds}::text[])
    `;

    // Same shape the per-user groupBy produced: absent when nothing was
    // recorded, and a zero total falls back to input + output.
    const totals = (rowCount: number, input: number, output: number, all: number) =>
      rowCount > 0
        ? { inputTokens: input, outputTokens: output, totalTokens: all || input + output }
        : undefined;

    return new Map(
      rows.map((row) => [
        row.id,
        {
          memberships: row.memberships,
          teams: row.teams,
          agents: row.agents,
          tokenUsage: row.tokenUsage,
          rangeUsage: totals(row.rangeRows, row.rangeInput, row.rangeOutput, row.rangeTotal),
          sortUsage:
            sortFrom === null
              ? undefined
              : totals(row.sortRows, row.sortInput, row.sortOutput, row.sortTotal),
          conversationLimits: {
            conversations: row.conversations,
            withLimit: row.withLimit,
            minLimit: row.minLimit,
            maxLimit: row.maxLimit,
          },
        },
      ]),
    );
  }

  // Get a single user by ID
  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user;
  }

  // Update a user by ID
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    await this.findUserById(id); // Ensure user exists
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete a user by ID
  async deleteUser(id: string): Promise<void> {
    await this.findUserById(id); // Ensure user exists

    // This will cascade delete all related userData due to Prisma's referential actions
    await this.prisma.user.delete({
      where: { id },
    });
  }

  // Additional helper methods for OAuth-based operations
  async findUserByOauthId(oauthId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { oauthId },
    });
    if (!user) {
      throw new NotFoundException(`User with OAuth ID "${oauthId}" not found.`);
    }
    return user;
  }

  async updateUserByOauthId(
    oauthId: string,
    data: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findUserByOauthId(oauthId);
    return this.prisma.user.update({
      where: { id: user.id },
      data,
    });
  }

  async deleteUserByOauthId(oauthId: string): Promise<void> {
    const user = await this.findUserByOauthId(oauthId);
    await this.prisma.user.delete({
      where: { id: user.id },
    });
  }

  // Sync user from Clerk: create if not exists, update email/username if exists
  async syncUser(
    oauthId: string,
    email: string,
    username?: string,
  ): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Known oauthId → just refresh contact fields.
    const byOauthId = await this.prisma.user.findUnique({ where: { oauthId } });
    if (byOauthId) {
      return this.prisma.user.update({
        where: { oauthId },
        data: { email: normalizedEmail, username },
      });
    }

    // 2. Unknown oauthId but the email already exists (e.g. the user
    //    re-authenticated and Clerk issued a new id, or the row was seeded
    //    from an export). Reconcile by moving the existing account to the new
    //    oauthId instead of trying to create a duplicate and hitting the
    //    `email @unique` constraint.
    const byEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { oauthId, username: username ?? byEmail.username ?? undefined },
      });
    }

    // 3. Brand new user.
    return this.prisma.user.create({
      data: { oauthId, email: normalizedEmail, username },
    });
  }

  // ALERTS
  async getAlerts(oauthId: string) {
    const user = await this.findUserByOauthId(oauthId);
    return this.prisma.userAlert.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dismissAlert(alertId: string) {
    return this.prisma.userAlert.update({
      where: { id: alertId },
      data: { read: true },
    });
  }
}
