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
  groups?: {
    monthlyTokenLimit?: number | null;
    group?: {
      items?: { agentName?: string }[];
    } | null;
  }[];
  memberships?: {
    monthlyTokenLimit?: number | null;
    template?: {
      monthlyTokenLimit?: number | null;
      includedAgents?: string[] | null;
      includedGroups?: {
        group?: { items?: { agentName?: string }[] } | null;
      }[] | null;
    } | null;
  }[];
  tokenUsage?: {
    agentName?: string;
    totalTokenLimit?: number | null;
  }[];
};

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

  (user.groups ?? []).forEach((assignment) => {
    total += assignment.monthlyTokenLimit ?? 0;
    assignment.group?.items?.forEach((item) => {
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
    // Agents reached through a team the membership bundles are covered too,
    // so their standalone token-usage limit is not added on top.
    assignment.template?.includedGroups?.forEach((link) => {
      link.group?.items?.forEach((item) => {
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
              groups: {
                some: {
                  group: {
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
                    groups: {
                      some: {
                        group: {
                          items: {
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
                              includedGroups: {
                                some: {
                                  isActive: true,
                                  group: {
                                    items: {
                                      some: {
                                        agentName: { in: matchingAgents },
                                      },
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
    // (membership, group, or agent) is active and not expired by then.
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
          { groups: { some: live } },
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
    const matched = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        oauthId: true,
        createdAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            monthlyTokenLimit: true,
            template: {
              select: {
                durationDays: true,
                monthlyTokenLimit: true,
                includedAgents: true,
                includedGroups: {
                  where: { isActive: true },
                  select: {
                    group: { select: { items: { select: { agentName: true } } } },
                  },
                },
              },
            },
          },
        },
        groups: {
          where: { isActive: true },
          select: {
            durationDays: true,
            monthlyTokenLimit: true,
            group: {
              select: {
                items: { select: { agentName: true } },
              },
            },
          },
        },
        agents: {
          where: { isActive: true },
          select: {
            agentName: true,
            durationDays: true,
            monthlyTokenLimit: true,
          },
        },
        tokenUsage: {
          select: {
            agentName: true,
            totalTokenLimit: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = matched.length;
    const totalPages = Math.ceil(total / limit);
    // Clamp so a stale page (e.g. after filters shrink the set) still
    // returns the last page instead of an empty one.
    const page = Math.min(requestedPage, Math.max(totalPages, 1));
    const skip = (page - 1) * limit;

    const oauthIds = matched.map((user) => user.oauthId);
    const sumUsageByOauthId = async (from: Date, to: Date) => {
      if (oauthIds.length === 0 || from > to) {
        return new Map<string, UsageTotals>();
      }
      const rows = await this.prisma.dailyTokenUsage.groupBy({
        by: ['oauthId'],
        where: { oauthId: { in: oauthIds }, date: { gte: from, lte: to } },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
      });
      return new Map(
        rows.map((row) => {
          const inputTokens = row._sum.inputTokens ?? 0;
          const outputTokens = row._sum.outputTokens ?? 0;
          const totalTokens =
            row._sum.totalTokens || inputTokens + outputTokens;
          return [
            row.oauthId,
            { inputTokens, outputTokens, totalTokens },
          ] as const;
        }),
      );
    };

    const todayUtc = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const weekStart = new Date(todayUtc);
    weekStart.setUTCDate(todayUtc.getUTCDate() - 6);
    const laterDate = (a: Date, b: Date) => (a >= b ? a : b);

    const monthlyTotals = await sumUsageByOauthId(rangeStart, rangeEnd);
    const usageSortTotals =
      sortBy === 'monthly'
        ? monthlyTotals
        : sortBy === 'weekly'
          ? await sumUsageByOauthId(laterDate(rangeStart, weekStart), rangeEnd)
          : sortBy === 'daily'
            ? await sumUsageByOauthId(laterDate(rangeStart, todayUtc), rangeEnd)
            : undefined;

    type MatchedUser = (typeof matched)[number] & {
      memberships?: { template: { durationDays: number } | null }[];
      groups?: { durationDays: number | null }[];
      agents?: { durationDays: number | null }[];
    };
    const durationOf = (user: MatchedUser) =>
      user.memberships?.[0]?.template?.durationDays ??
      user.groups?.[0]?.durationDays ??
      user.agents?.[0]?.durationDays ??
      0;

    const direction = sortDir === 'asc' ? 1 : -1;
    const sorted = [...matched].sort((a, b) => {
      const aValue = usageSortTotals
        ? (usageSortTotals.get(a.oauthId)?.totalTokens ?? 0)
        : sortBy === 'duration'
          ? durationOf(a as MatchedUser)
          : a.createdAt.getTime();
      const bValue = usageSortTotals
        ? (usageSortTotals.get(b.oauthId)?.totalTokens ?? 0)
        : sortBy === 'duration'
          ? durationOf(b as MatchedUser)
          : b.createdAt.getTime();
      if (aValue !== bValue) return (aValue - bValue) * direction;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const pageIds = sorted.slice(skip, skip + limit).map((user) => user.id);
    const pageUsers = await this.prisma.user.findMany({
      where: { id: { in: pageIds } },
      include: {
        agents: true,
        groups: {
          where: { isActive: true },
          include: { group: { include: { items: true } } },
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

    // Conversation token limits are assigned in bulk per user, so the list only
    // needs one aggregate per row rather than the conversations themselves:
    // the shared limit when every conversation carries the same one, plus the
    // counts needed to tell "none set" apart from "set on some of them".
    const limitRows = await this.prisma.conversation.groupBy({
      by: ['userId'],
      where: { userId: { in: pageIds } },
      _min: { tokenLimit: true },
      _max: { tokenLimit: true },
      _count: { _all: true, tokenLimit: true },
    });
    const limitsByUserId = new Map(limitRows.map((row) => [row.userId, row]));

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

        const limits = limitsByUserId.get(user.id);
        const conversations = limits?._count._all ?? 0;
        const withLimit = limits?._count.tokenLimit ?? 0;
        // A single reportable limit only exists when every conversation carries
        // it; anything else is reported as mixed so the caller does not show a
        // limit that only part of the chats actually has.
        const isUniform =
          conversations > 0 &&
          withLimit === conversations &&
          limits?._min.tokenLimit === limits?._max.tokenLimit;
        const uniformLimit = isUniform
          ? (limits?._min.tokenLimit ?? null)
          : null;

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
