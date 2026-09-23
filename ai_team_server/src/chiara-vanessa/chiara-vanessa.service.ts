import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class ChiaraVanessaService {
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
  ): Prisma.ChiaraVanessaChatLogWhereInput {
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

  // ChiaraVanessaChatLog methods
  async createChatLog(data: Prisma.ChiaraVanessaChatLogCreateInput) {
    return this.prisma.chiaraVanessaChatLog.create({
      data,
    });
  }

  async getChatLogsBySessionId(sessionId: string) {
    return this.prisma.chiaraVanessaChatLog.findMany({
      where: this.getRelatedSessionWhere(sessionId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getAllSessions() {
    const sessions = await this.prisma.chiaraVanessaChatLog.groupBy({
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

  // ChiaraVanessaLead methods
  // A session can hold many leads here, so a create never conflicts.
  async createLead(data: Prisma.ChiaraVanessaLeadCreateInput) {
    return this.prisma.chiaraVanessaLead.create({ data });
  }

  async getAllLeads() {
    return this.prisma.chiaraVanessaLead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeadsBySessionId(sessionId: string) {
    return this.prisma.chiaraVanessaLead.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeadById(id: number) {
    const lead = await this.prisma.chiaraVanessaLead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`No Vanessa lead with id ${id}.`);
    }

    return lead;
  }

  async updateLead(id: number, data: Prisma.ChiaraVanessaLeadUpdateInput) {
    await this.getLeadById(id);

    return this.prisma.chiaraVanessaLead.update({
      where: { id },
      data,
    });
  }

  async deleteLead(id: number) {
    await this.getLeadById(id);

    return this.prisma.chiaraVanessaLead.delete({
      where: { id },
    });
  }
}
