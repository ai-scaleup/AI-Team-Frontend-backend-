
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

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
        // User messages are stored with sessionId = "PHONE|| PHONE" (n8n artifact),
        // while AI messages use the clean "PHONE" sessionId.
        // We fetch both variants and merge by timestamp so the full conversation is visible.
        return this.prisma.chiaraInboundChatLog.findMany({
            where: {
                OR: [
                    { sessionId },
                    { sessionId: { startsWith: sessionId + '||' } },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getDistinctSenders() {
        const rows = await this.prisma.chiaraInboundChatLog.findMany({
            select: { sender: true },
            distinct: ['sender'],
        });
        return rows.map(r => r.sender);
    }

    async getAllSessions() {
        const rows = await this.prisma.chiaraInboundChatLog.groupBy({
            by: ['sessionId'],
            _max: { createdAt: true },
            _count: { id: true },
            orderBy: { _max: { createdAt: 'desc' } },
        });

        // Normalise: strip the "|| ..." suffix that n8n appends to user-message sessionIds,
        // then merge counts so each phone number appears once with a combined total.
        const map = new Map<string, { lastMessageAt: Date | null; messageCount: number }>()
        for (const row of rows) {
            const base = row.sessionId.includes('||')
                ? row.sessionId.split('||')[0].trim()
                : row.sessionId
            const existing = map.get(base)
            const rowMax = row._max.createdAt
            if (!existing) {
                map.set(base, { lastMessageAt: rowMax, messageCount: row._count.id })
            } else {
                map.set(base, {
                    lastMessageAt:
                        rowMax && existing.lastMessageAt && rowMax > existing.lastMessageAt
                            ? rowMax
                            : existing.lastMessageAt,
                    messageCount: existing.messageCount + row._count.id,
                })
            }
        }

        return [...map.entries()]
            .map(([sessionId, v]) => ({
                sessionId,
                lastMessageAt: v.lastMessageAt,
                messageCount: v.messageCount,
            }))
            .sort((a, b) => {
                if (!a.lastMessageAt) return 1
                if (!b.lastMessageAt) return -1
                return b.lastMessageAt > a.lastMessageAt ? 1 : -1
            })
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
