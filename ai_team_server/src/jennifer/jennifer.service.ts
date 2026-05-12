import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JenniferService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessions() {
    // Get distinct sessionIds from ChatLog
    const logs = await this.prisma.chatLog.findMany({
      select: {
        sessionId: true,
      },
      distinct: ['sessionId'],
    });
    return logs.map((log) => log.sessionId);
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
