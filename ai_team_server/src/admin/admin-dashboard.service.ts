import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type RecentAssignment = {
  id: string;
  user: string;
  type: 'Membership' | 'Team' | 'Agent';
  package: string;
  durationDays: number | null;
  tokens: number;
  assignedAt: Date;
};

type AgentUsageChartPoint = {
  date: string;
  week?: string;
  total: number;
  [agentName: string]: string | number | undefined;
};

const inputKey = (agentName: string) => `${agentName}__input`;
const outputKey = (agentName: string) => `${agentName}__output`;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getDurationDays(startsAt: Date, expiresAt: Date | null): number | null {
    if (!expiresAt) return null;

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(
      1,
      Math.ceil((expiresAt.getTime() - startsAt.getTime()) / msPerDay),
    );
  }

  private async getAgentTokenLimit(oauthId: string, agentName: AgentName) {
    const usage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalTokenLimit: true },
    });

    return usage?.totalTokenLimit ?? 0;
  }

  // ======================== USERS & ANALYTICS ========================
  async listUsersDetailed(search?: string, daysLimit: number = 30) {
    const now = new Date();
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');

    const users = await this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        agents: true,
        groups: { include: { group: true } },
        memberships: { include: { template: true } },
        dailyUsage: {
          where: { date: { gte: monthStart } },
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const sumUsage = (items: typeof u.dailyUsage) =>
        items.reduce(
          (sum, item) => ({
            input: sum.input + item.inputTokens,
            output: sum.output + item.outputTokens,
            total: sum.total + item.totalTokens,
          }),
          { input: 0, output: 0, total: 0 },
        );
      const monthly = sumUsage(u.dailyUsage);
      const weekly = sumUsage(u.dailyUsage.filter((item) => item.date >= weekStart));
      const daily = sumUsage(u.dailyUsage.filter((item) => item.date >= today));

      return {
        id: u.id,
        oauthId: u.oauthId,
        email: u.email,
        username: u.username,
        createdAt: u.createdAt,
        agents: u.agents,
        groups: u.groups,
        memberships: u.memberships,
        usage: {
          monthly: monthly.total,
          monthlyInputTokens: monthly.input,
          monthlyOutputTokens: monthly.output,
          weekly: weekly.total,
          weeklyInputTokens: weekly.input,
          weeklyOutputTokens: weekly.output,
          daily: daily.total,
          dailyInputTokens: daily.input,
          dailyOutputTokens: daily.output,
        },
      };
    });
  }

  async listRecentAssignments(limit: number = 6): Promise<RecentAssignment[]> {
    const take = Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 6));

    const [memberships, groups, agents, tokenLimits] =
      await this.prisma.$transaction([
        this.prisma.assignedMembership.findMany({
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { email: true } },
            template: { select: { name: true, monthlyTokenLimit: true } },
          },
        }),
        this.prisma.assignedGroup.findMany({
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { email: true } },
            group: { select: { name: true } },
          },
        }),
        this.prisma.assignedAgent.findMany({
          take,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true, oauthId: true } } },
        }),
        this.prisma.userAgentTokenUsage.findMany({
          take,
          orderBy: { updatedAt: 'desc' },
          include: { user: { select: { email: true } } },
        }),
      ]);

    const agentRows = await Promise.all(
      agents.map(async (assignment): Promise<RecentAssignment> => ({
        id: `agent-${assignment.id}`,
        user: assignment.user.email,
        type: 'Agent',
        package: assignment.agentName,
        durationDays:
          assignment.durationDays ??
          this.getDurationDays(assignment.startsAt, assignment.expiresAt),
        tokens:
          assignment.monthlyTokenLimit ??
          (await this.getAgentTokenLimit(
            assignment.user.oauthId,
            assignment.agentName,
          )),
        assignedAt: assignment.createdAt,
      })),
    );

    const rows: RecentAssignment[] = [
      ...memberships.map((assignment) => ({
        id: `membership-${assignment.id}`,
        user: assignment.user.email,
        type: 'Membership' as const,
        package: assignment.template.name,
        durationDays: this.getDurationDays(
          assignment.startsAt,
          assignment.expiresAt,
        ),
        tokens:
          assignment.monthlyTokenLimit ?? assignment.template.monthlyTokenLimit,
        assignedAt: assignment.createdAt,
      })),
      ...groups.map((assignment) => ({
        id: `team-${assignment.id}`,
        user: assignment.user.email,
        type: 'Team' as const,
        package: assignment.group.name,
        durationDays:
          assignment.durationDays ??
          this.getDurationDays(assignment.startsAt, assignment.expiresAt),
        tokens: assignment.monthlyTokenLimit ?? 0,
        assignedAt: assignment.createdAt,
      })),
      ...agentRows,
      ...tokenLimits.map((usage) => ({
        id: `token-limit-${usage.id}`,
        user: usage.user.email,
        type: 'Agent' as const,
        package: usage.agentName,
        durationDays: null,
        tokens: usage.totalTokenLimit,
        assignedAt: usage.updatedAt,
      })),
    ];

    return rows
      .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())
      .slice(0, take);
  }

  async getAgentUsageMetrics(daysLimit: number = 30, topLimit: number = 5) {
    const safeDays = Math.min(
      365,
      Math.max(1, Number.isFinite(daysLimit) ? daysLimit : 30),
    );
    const safeTopLimit = Math.min(
      50,
      Math.max(1, Number.isFinite(topLimit) ? topLimit : 5),
    );
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    );
    const fromDate = new Date(todayUtc);
    fromDate.setUTCDate(todayUtc.getUTCDate() - safeDays + 1);

    const rows = await this.prisma.dailyTokenUsage.findMany({
      where: { date: { gte: fromDate } },
      include: { user: { select: { email: true, username: true } } },
      orderBy: { date: 'asc' },
    });

    const agentNames = Array.from(
      new Set(rows.map((row) => row.agentName)),
    ).sort();
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const dailyByDate = new Map<string, AgentUsageChartPoint>();

    for (let index = 0; index < safeDays; index += 1) {
      const date = new Date(fromDate);
      date.setUTCDate(fromDate.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const point: AgentUsageChartPoint = {
        date: dateFormatter.format(date),
        total: 0,
      };
      agentNames.forEach((agent) => {
        point[agent] = 0;
      });
      dailyByDate.set(key, point);
    }

    const topUserMap = new Map<
      AgentName,
      Map<
        string,
        { name: string; email: string; tokens: number; inputTokens: number; outputTokens: number }
      >
    >();

    rows.forEach((row) => {
      const key = row.date.toISOString().slice(0, 10);
      const point = dailyByDate.get(key);

      if (point) {
        point[row.agentName] = Number(point[row.agentName] ?? 0) + row.totalTokens;
        point[inputKey(row.agentName)] =
          Number(point[inputKey(row.agentName)] ?? 0) + row.inputTokens;
        point[outputKey(row.agentName)] =
          Number(point[outputKey(row.agentName)] ?? 0) + row.outputTokens;
        point.total = Number(point.total ?? 0) + row.totalTokens;
      }

      const agentUsers =
        topUserMap.get(row.agentName) ??
        new Map<
          string,
          { name: string; email: string; tokens: number; inputTokens: number; outputTokens: number }
        >();
      const existing = agentUsers.get(row.oauthId);
      agentUsers.set(row.oauthId, {
        name:
          row.user?.username ||
          row.user?.email?.split('@')[0] ||
          row.oauthId,
        email: row.user?.email ?? row.oauthId,
        tokens: (existing?.tokens ?? 0) + row.totalTokens,
        inputTokens: (existing?.inputTokens ?? 0) + row.inputTokens,
        outputTokens: (existing?.outputTokens ?? 0) + row.outputTokens,
      });
      topUserMap.set(row.agentName, agentUsers);
    });

    const dailyUsage = Array.from(dailyByDate.values());
    const weeklyByIndex = new Map<number, AgentUsageChartPoint>();

    dailyUsage.forEach((day, index) => {
      const weekIndex = Math.floor(index / 7);
      const current =
        weeklyByIndex.get(weekIndex) ?? {
          date: `Week ${weekIndex + 1}`,
          week: `Week ${weekIndex + 1}`,
          total: 0,
        };

      agentNames.forEach((agent) => {
        current[agent] =
          Number(current[agent] ?? 0) + Number(day[agent] ?? 0);
        current[inputKey(agent)] =
          Number(current[inputKey(agent)] ?? 0) +
          Number(day[inputKey(agent)] ?? 0);
        current[outputKey(agent)] =
          Number(current[outputKey(agent)] ?? 0) +
          Number(day[outputKey(agent)] ?? 0);
      });
      current.total = Number(current.total ?? 0) + Number(day.total ?? 0);
      weeklyByIndex.set(weekIndex, current);
    });

    const topUsersByAgent = Object.fromEntries(
      Array.from(topUserMap.entries()).map(([agent, users]) => [
        agent,
        Array.from(users.values())
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, safeTopLimit),
      ]),
    );

    return {
      days: safeDays,
      agents: agentNames,
      dailyUsage,
      weeklyUsage: Array.from(weeklyByIndex.values()),
      topUsersByAgent,
    };
  }

  async getUserDetails(
    userId: string,
    daysLimit: number = 30,
    usageFrom?: Date,
    usageTo?: Date,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        agents: true,
        groups: { include: { group: { include: { items: true } } } },
        memberships: { include: { template: true } },
        tokenUsage: true,
        alerts: { orderBy: { createdAt: 'desc' }, take: 10 },
        stopLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const fallbackToDate = new Date();
    const fallbackFromDate = new Date(fallbackToDate);
    fallbackFromDate.setDate(fallbackToDate.getDate() - daysLimit);
    const requestedFrom = usageFrom ?? fallbackFromDate;
    const requestedTo = usageTo ?? fallbackToDate;
    const rangeStart =
      requestedFrom <= requestedTo ? requestedFrom : requestedTo;
    const rangeEnd = requestedFrom <= requestedTo ? requestedTo : requestedFrom;

    const dailyUsage = await this.prisma.dailyTokenUsage.findMany({
      where: { oauthId: user.oauthId, date: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { date: 'asc' },
    });

    return { user, dailyUsage };
  }

  // ======================== BULK ACTIONS ========================
  async resetAllUsage() {
    const [
      tokenUsage,
      dailyUsage,
      stopLogs,
      agentAssignments,
      groupAssignments,
      membershipAssignments,
      tokenAlerts,
      membershipTemplates,
    ] = await this.prisma.$transaction([
      this.prisma.userAgentTokenUsage.updateMany({
        data: {
          totalUsedInputTokens: 0,
          totalUsedOutputTokens: 0,
          totalUsedTokens: 0,
          totalTokensLeft: 0,
          totalTokenLimit: 0,
        },
      }),
      this.prisma.dailyTokenUsage.updateMany({
        data: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      }),
      this.prisma.tokenLimitStopLog.deleteMany(),
      this.prisma.assignedAgent.updateMany({
        data: {
          monthlyTokenLimit: 0,
          threshold50Notified: false,
          threshold80Notified: false,
          threshold90Notified: false,
          threshold100Notified: false,
        },
      }),
      this.prisma.assignedGroup.updateMany({
        data: {
          monthlyTokenLimit: 0,
          threshold50Notified: false,
          threshold80Notified: false,
          threshold90Notified: false,
          threshold100Notified: false,
        },
      }),
      this.prisma.assignedMembership.updateMany({
        data: {
          threshold50Notified: false,
          threshold80Notified: false,
          threshold90Notified: false,
          threshold100Notified: false,
        },
      }),
      this.prisma.userAlert.updateMany({
        where: { type: { startsWith: 'TOKEN_THRESHOLD_' } },
        data: { read: true },
      }),
      this.prisma.membershipTemplate.updateMany({
        data: { monthlyTokenLimit: 0 },
      }),
    ]);

    return {
      tokenUsageRowsReset: tokenUsage.count,
      dailyUsageRowsReset: dailyUsage.count,
      stopLogsDeleted: stopLogs.count,
      agentAssignmentsReset: agentAssignments.count,
      groupAssignmentsReset: groupAssignments.count,
      membershipAssignmentsReset: membershipAssignments.count,
      tokenAlertsDismissed: tokenAlerts.count,
      membershipTemplatesReset: membershipTemplates.count,
    };
  }

  async bulkUpdateUsers(
    userIds: string[],
    updates: { deactivateMemberships?: boolean; deactivateAgents?: boolean },
  ) {
    const results = { membershipsAffected: 0, agentsAffected: 0 };

    if (updates.deactivateMemberships) {
      const res = await this.prisma.assignedMembership.updateMany({
        where: { userId: { in: userIds }, isActive: true },
        data: { isActive: false },
      });
      results.membershipsAffected = res.count;
    }

    if (updates.deactivateAgents) {
      const res = await this.prisma.assignedAgent.updateMany({
        where: { userId: { in: userIds }, isActive: true },
        data: { isActive: false },
      });
      results.agentsAffected = res.count;
    }

    return results;
  }
}
