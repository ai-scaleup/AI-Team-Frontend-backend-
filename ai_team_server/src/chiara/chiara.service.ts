import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class ChiaraService {
  constructor(private prisma: PrismaService) {}

  private normalizeSessionId(sessionId: string) {
    return sessionId
      .split('||')
      .map((part) => part.trim())
      .find(Boolean) ?? sessionId;
  }

  private getRelatedSessionWhere(sessionId: string): Prisma.ChiaraInboundChatLogWhereInput {
    const normalizedSessionId = this.normalizeSessionId(sessionId);

    return {
      OR: [
        { sessionId },
        { sessionId: normalizedSessionId },
        { sessionId: { startsWith: `${normalizedSessionId}||` } },
        { sessionId: { endsWith: `||${normalizedSessionId}` } },
        { sessionId: { contains: `||${normalizedSessionId}||` } },
      ],
    };
  }

  // ChiaraInboundChatLog methods
  async createChatLog(data: Prisma.ChiaraInboundChatLogCreateInput) {
    return this.prisma.chiaraInboundChatLog.create({
      data,
    });
  }

  async getChatLogsBySessionId(sessionId: string) {
    return this.prisma.chiaraInboundChatLog.findMany({
      where: this.getRelatedSessionWhere(sessionId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getAllSessions() {
    const sessions = await this.prisma.chiaraInboundChatLog.groupBy({
      by: ['sessionId'],
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    const mergedSessions = new Map<
      string,
      {
        sessionId: string;
        lastMessageAt: Date | null;
        messageCount: number;
      }
    >();

    for (const session of sessions) {
      const normalizedSessionId = this.normalizeSessionId(session.sessionId);
      const existing = mergedSessions.get(normalizedSessionId);

      if (!existing) {
        mergedSessions.set(normalizedSessionId, {
          sessionId: normalizedSessionId,
          lastMessageAt: session._max.createdAt,
          messageCount: session._count.id,
        });
        continue;
      }

      existing.messageCount += session._count.id;
      if (
        session._max.createdAt &&
        (!existing.lastMessageAt || session._max.createdAt > existing.lastMessageAt)
      ) {
        existing.lastMessageAt = session._max.createdAt;
      }
    }

    return Array.from(mergedSessions.values()).sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() ?? 0;
      const bTime = b.lastMessageAt?.getTime() ?? 0;

      return bTime - aTime;
    });
  }

  // ChiaraLead methods
  async createLead(data: Prisma.ChiaraLeadCreateInput) {
    // Since sessionId is unique, we might want to upsert or check existence,
    // but for now simple create as per requirement.
    // If unique constraint violation occurs, it will throw error which is handled by global filter or we can handle it here.
    // Given the requirement "just need create and get", I'll stick to create.
    return this.prisma.chiaraLead.create({
      data,
    });
  }

  async getLeadBySessionId(sessionId: string) {
    return this.prisma.chiaraLead.findUnique({
      where: { sessionId },
    });
  }

  async getAllLeads() {
    return this.prisma.chiaraLead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
