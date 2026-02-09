import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';

// Database connection string for the external metis_whatsapp database
// Using 'METIS_DATABASE_URL' from .env
const DATABASE_URL = process.env.METIS_DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('METIS_DATABASE_URL is not defined in environment variables');
}

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
    private client: Client | null = null;

    private async getClient(): Promise<Client> {
        if (!this.client) {
            this.client = new Client({
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await this.client.connect();
        }
        return this.client;
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
    }

    /**
     * Get all unique chat sessions with message counts
     */
    async getAllSessions(): Promise<{ sessions: ChatSession[]; totalSessions: number }> {
        const client = await this.getClient();

        const query = `
            SELECT 
                session_id as "phoneNumber",
                COUNT(*) as "messageCount",
                MAX(created_at) as "lastMessageAt"
            FROM chat_logs
            WHERE session_id IS NOT NULL AND session_id != ''
            GROUP BY session_id
            ORDER BY MAX(created_at) DESC
        `;

        const result = await client.query(query);

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
        const client = await this.getClient();

        const query = `
            SELECT 
                id,
                sender,
                message_text as "text",
                created_at as "createdAt"
            FROM chat_logs
            WHERE session_id = $1
            ORDER BY created_at ASC
        `;

        const result = await client.query(query, [phoneNumber]);

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
        const client = await this.getClient();

        const query = `
            SELECT 
                COUNT(*) as "totalMessages",
                COUNT(DISTINCT session_id) as "totalSessions",
                MIN(created_at) as "oldestMessage",
                MAX(created_at) as "newestMessage"
            FROM chat_logs
        `;

        const result = await client.query(query);
        const row = result.rows[0];

        return {
            totalMessages: parseInt(row.totalMessages, 10),
            totalSessions: parseInt(row.totalSessions, 10),
            oldestMessage: row.oldestMessage,
            newestMessage: row.newestMessage
        };
    }
}
