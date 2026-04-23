import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ======================== MEMBERSHIPS ========================
  async createMembership(data: { name: string; durationDays: number; monthlyTokenLimit: number; includedAgents?: string[]; includedGroupIds?: string[] }) {
    return this.prisma.membershipTemplate.create({
      data: {
        name: data.name,
        durationDays: data.durationDays,
        monthlyTokenLimit: data.monthlyTokenLimit,
        includedAgents: data.includedAgents as any || [],
        includedGroupIds: data.includedGroupIds || [],
      }
    });
  }

  async listMemberships() {
    return this.prisma.membershipTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async assignMembership(userId: string, membershipTemplateId: string, durationOverride?: number) {
    const template = await this.prisma.membershipTemplate.findUnique({ where: { id: membershipTemplateId } });
    if (!template) throw new NotFoundException('Template not found');

    const durationDays = durationOverride ?? template.durationDays;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const expiresAt = new Date(Date.now() + durationDays * MS_PER_DAY);

    return this.prisma.assignedMembership.create({
      data: {
        userId,
        membershipTemplateId,
        expiresAt,
        isActive: true
      }
    });
  }

  // ======================== USERS & ANALYTICS ========================
  async listUsersDetailed(search?: string, daysLimit: number = 30) {
    const users = await this.prisma.user.findMany({
      where: search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } }
        ]
      } : undefined,
      include: {
        agents: true,
        groups: true,
        memberships: { include: { template: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(u => ({
      id: u.id,
      oauthId: u.oauthId,
      email: u.email,
      username: u.username,
      createdAt: u.createdAt,
      agents: u.agents,
      groups: u.groups,
      memberships: u.memberships,
    }));
  }

  async getUserDetails(userId: string, daysLimit: number = 30) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        agents: true,
        groups: true,
        memberships: { include: { template: true } },
        alerts: { orderBy: { createdAt: 'desc' }, take: 10 },
        stopLogs: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!user) throw new NotFoundException('User not found');

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysLimit);

    const dailyUsage = await this.prisma.dailyTokenUsage.findMany({
      where: { oauthId: user.oauthId, date: { gte: fromDate } },
      orderBy: { date: 'asc' }
    });

    return { user, dailyUsage };
  }

  // ======================== BULK ACTIONS ========================
  async bulkUpdateUsers(userIds: string[], updates: { deactivateMemberships?: boolean; deactivateAgents?: boolean }) {
    const results = { membershipsAffected: 0, agentsAffected: 0 };
    
    if (updates.deactivateMemberships) {
      const res = await this.prisma.assignedMembership.updateMany({
        where: { userId: { in: userIds }, isActive: true },
        data: { isActive: false }
      });
      results.membershipsAffected = res.count;
    }

    if (updates.deactivateAgents) {
      const res = await this.prisma.assignedAgent.updateMany({
        where: { userId: { in: userIds }, isActive: true },
        data: { isActive: false }
      });
      results.agentsAffected = res.count;
    }

    return results;
  }
}
