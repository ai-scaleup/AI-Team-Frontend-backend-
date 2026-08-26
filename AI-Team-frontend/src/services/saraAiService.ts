import { authenticatedFetch } from "@/lib/authenticatedFetch";
import {
    StatsResponse,
    SessionsResponse,
    ConversationResponse,
    AnalyticsResponse
} from '@/types/sara-ai';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export const saraAiService = {
    /**
     * GET /sara-ai/stats
     * Fetches overall statistics for Sara AI system
     */
    async getStats(): Promise<StatsResponse> {
        const response = await authenticatedFetch(`${API_BASE}/sara-ai/stats`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch stats');
        }
        return response.json();
    },

    /**
     * GET /sara-ai/chats
     * Fetches all chat sessions (phone numbers with message counts)
     */
    async getSessions(): Promise<SessionsResponse> {
        const response = await authenticatedFetch(`${API_BASE}/sara-ai/chats`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch sessions');
        }
        return response.json();
    },

    /**
     * GET /sara-ai/analytics?days=N
     * Fetches per-day message and conversation counts directly from the DB
     */
    async getAnalytics(days: number = 30): Promise<AnalyticsResponse> {
        const response = await authenticatedFetch(`${API_BASE}/sara-ai/analytics?days=${days}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch analytics');
        }
        return response.json();
    },

    /**
     * GET /sara-ai/chats/:phoneNumber
     * Fetches full conversation history for a specific phone number
     */
    async getConversation(phoneNumber: string): Promise<ConversationResponse> {
        const response = await authenticatedFetch(`${API_BASE}/sara-ai/chats/${encodeURIComponent(phoneNumber)}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            const error = await response.json();
            if (response.status === 404) {
                throw new Error(`No messages found for phone number: ${phoneNumber}`);
            }
            throw new Error(error.message || 'Failed to fetch conversation');
        }
        return response.json();
    },
};
