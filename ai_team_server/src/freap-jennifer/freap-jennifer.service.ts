import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class FreapJenniferService {
  constructor(private prisma: PrismaService) {}

  private normalizeSessionId(sessionId: string) {
    return (
      sessionId
        .split('||')
        .map((part) => part.trim())
        .find(Boolean) ?? sessionId
    );
  }

  private getRelatedSessionWhere(
    sessionId: string,
  ): Prisma.FreapJenniferChatLogWhereInput {
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

  async createChatLog(data: Prisma.FreapJenniferChatLogCreateInput) {
    return this.prisma.freapJenniferChatLog.create({
      data,
    });
  }

  async getChatLogsBySessionId(sessionId: string) {
    return this.prisma.freapJenniferChatLog.findMany({
      where: this.getRelatedSessionWhere(sessionId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getAllSessions() {
    const sessions = await this.prisma.freapJenniferChatLog.groupBy({
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
        (!existing.lastMessageAt ||
          session._max.createdAt > existing.lastMessageAt)
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
}
