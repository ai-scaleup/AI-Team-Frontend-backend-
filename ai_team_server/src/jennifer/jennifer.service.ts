import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JenniferService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessions() {
    // Get distinct sessionIds from ChatLog, most recently active first
    const sessions = await this.prisma.chatLog.groupBy({
      by: ['sessionId'],
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      lastMessageAt: session._max.createdAt,
      messageCount: session._count.id,
    }));
  }

  async getChatLogs(sessionId: string) {
    return this.prisma.chatLog.findMany({
      where: {
        sessionId: sessionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
