
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChiaraService {
    constructor(private prisma: PrismaService) { }

    // ChiaraInboundChatLog methods
    async createChatLog(data: Prisma.ChiaraInboundChatLogCreateInput) {
        return this.prisma.chiaraInboundChatLog.create({
            data,
        });
    }

    async getChatLogsBySessionId(sessionId: string) {
        return this.prisma.chiaraInboundChatLog.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getAllSessions() {
        const sessions = await this.prisma.chiaraInboundChatLog.groupBy({
            by: ['sessionId'],
            _max: { createdAt: true },
            _count: { id: true },
            orderBy: { _max: { createdAt: 'desc' } },
        });

        return sessions.map((s) => ({
            sessionId: s.sessionId,
            lastMessageAt: s._max.createdAt,
            messageCount: s._count.id,
        }));
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
