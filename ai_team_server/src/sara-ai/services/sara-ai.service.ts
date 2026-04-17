import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export interface ChatSession {
    phoneNumber: string;
    messageCount: number;
    lastMessageAt: Date | null;
}

export interface ChatMessage {
    id: number;
    sender: string;
    text: string;
    createdAt: Date;
}

@Injectable()
export class SaraAiService implements OnModuleDestroy {
    private pool: Pool;

    constructor() {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL is not defined in environment variables');
        this.pool = new Pool({ connectionString: url });
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    /**
     * Get all unique chat sessions with message counts
     */
    async getAllSessions(): Promise<{ sessions: ChatSession[]; totalSessions: number }> {
        // Normalize session_id: some rows store "phone|| phone" — extract just the phone part
        const query = `
            SELECT
                TRIM(SPLIT_PART(session_id, '||', 1)) as "phoneNumber",
                COUNT(*) as "messageCount",
                MAX(created_at) as "lastMessageAt"
            FROM metis_chat_logs
            WHERE session_id IS NOT NULL AND TRIM(session_id) != ''
            GROUP BY TRIM(SPLIT_PART(session_id, '||', 1))
            ORDER BY MAX(created_at) DESC
        `;

        const result = await this.pool.query(query);

        const sessions: ChatSession[] = result.rows.map(row => ({
            phoneNumber: row.phoneNumber,
            messageCount: parseInt(row.messageCount, 10),
            lastMessageAt: row.lastMessageAt
        }));

        return {
            sessions,
            totalSessions: sessions.length
        };
    }

    /**
     * Get all messages for a specific phone number
     */
    async getConversation(phoneNumber: string): Promise<{ phoneNumber: string; messages: ChatMessage[]; totalMessages: number }> {
        // Match both "phone" and "phone|| phone" variants stored in the DB
        const query = `
            SELECT id, sender, message_text as "text", created_at as "createdAt"
            FROM (
                SELECT id, sender, message_text, created_at
                FROM metis_chat_logs
                WHERE TRIM(SPLIT_PART(session_id, '||', 1)) = $1
                ORDER BY created_at DESC
                LIMIT 100
            ) sub
            ORDER BY created_at ASC
        `;

        const result = await this.pool.query(query, [phoneNumber.trim()]);

        const messages: ChatMessage[] = result.rows.map(row => ({
            id: row.id,
            sender: row.sender || 'unknown',
            text: row.text || '',
            createdAt: row.createdAt
        }));

        return {
            phoneNumber,
            messages,
            totalMessages: messages.length
        };
    }

    /**
     * Get statistics about the database
     */
    async getStats(): Promise<{ totalMessages: number; totalSessions: number; oldestMessage: Date | null; newestMessage: Date | null }> {
        const query = `
            SELECT
                COUNT(*) as "totalMessages",
                COUNT(DISTINCT session_id) as "totalSessions",
                MIN(created_at) as "oldestMessage",
                MAX(created_at) as "newestMessage"
            FROM metis_chat_logs
        `;

        const result = await this.pool.query(query);
        const row = result.rows[0];

        return {
            totalMessages: parseInt(row.totalMessages, 10),
            totalSessions: parseInt(row.totalSessions, 10),
            oldestMessage: row.oldestMessage,
            newestMessage: row.newestMessage
        };
    }
}
