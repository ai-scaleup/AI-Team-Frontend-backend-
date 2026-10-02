// src/admin/admin.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SingleAssignedAgent,
  User,
  AgentName,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * User-level admin reads. The three assignment tiers each own their tables and
 * routes and never reach into each other:
 *   - single agents: SingleAssignedAgentModule  (/admin/single-agent-assignments)
 *   - teams:         AgentTeamModule            (/admin/teams, /admin/team-assignments)
 *   - memberships:   MembershipModule           (/memberships)
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fetch user by email; ALWAYS error if not found (no auto-create). */
  private async getUserByEmail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new NotFoundException(`User with email "${email}" not found`);
    return user;
  }

  /* --------------------------- public API (email) -------------------------- */

  /** List single-agent assignments for a user by email. */
  async listAssignmentsByEmail(
    email: string,
    activeOnly = false,
  ): Promise<SingleAssignedAgent[]> {
    const user = await this.getUserByEmail(email.trim());
    const now = new Date();

    const where: Prisma.SingleAssignedAgentWhereInput = {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
      ...(activeOnly
        ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
        : {}),
    };

    return this.prisma.singleAssignedAgent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get selected (active & not expired) agent names for a user by email. */
  async getSelectedAgentsByEmail(email: string): Promise<AgentName[]> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());

    const now = new Date();
    const rows = await this.prisma.singleAssignedAgent.findMany({
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

  /** Directly assigned agents for a user by email (single-agent tier only). */
  async getAgentsByEmail(
    email: string,
    activeOnly = true,
  ): Promise<{ email: string; agents: AgentName[] }> {
    if (!email?.trim()) throw new BadRequestException('email is required');
    const user = await this.getUserByEmail(email.trim());
    const now = new Date();

    const where: Prisma.SingleAssignedAgentWhereInput = {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
      ...(activeOnly
        ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
        : {}),
    };

    const assignments = await this.prisma.singleAssignedAgent.findMany({
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

  async listAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserTokenStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    if (!user) throw new NotFoundException(`User "${userId}" not found`);

    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      select: {
        id: true,
        agentId: true,
        title: true,
        lastUpdated: true,
        _count: { select: { messages: true } },
      },
      orderBy: { lastUpdated: 'desc' },
    });

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce(
      (s, c) => s + c._count.messages,
      0,
    );

    // Group by agentId
    const agentMap = new Map<
      string,
      { agentId: string; conversations: number; messages: number }
    >();
    for (const c of conversations) {
      const entry = agentMap.get(c.agentId) ?? {
        agentId: c.agentId,
        conversations: 0,
        messages: 0,
      };
      entry.conversations += 1;
      entry.messages += c._count.messages;
      agentMap.set(c.agentId, entry);
    }
    const byAgent = Array.from(agentMap.values()).sort(
      (a, b) => b.messages - a.messages,
    );

    const lastActivity = conversations[0]?.lastUpdated ?? null;

    return {
      user,
      totalConversations,
      totalMessages,
      byAgent,
      lastActivity,
    };
  }
}
