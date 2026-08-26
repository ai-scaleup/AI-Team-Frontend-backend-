import { authenticatedFetch } from "@/lib/authenticatedFetch";
import { Conversation, Message, CreateConversationDto, UpdateConversationDto, AddMessageDto } from '@/types/conversation';
import { waitForUserSync } from '@/lib/userSyncGate';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export const conversationService = {
    // Create or Upsert a conversation
    async createConversation(oauthId: string, data: CreateConversationDto): Promise<Conversation> {
        await waitForUserSync();
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create conversation');
        }
        return response.json();
    },

    // Get all conversations for a user
    async getConversations(oauthId: string, agentId?: string): Promise<Conversation[]> {
        await waitForUserSync();
        const url = agentId
            ? `${API_BASE}/conversations/${oauthId}?agentId=${agentId}`
            : `${API_BASE}/conversations/${oauthId}`;
        const response = await authenticatedFetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch conversations');
        }
        return response.json();
    },

    // Get a single conversation
    async getConversation(oauthId: string, conversationId: string): Promise<Conversation> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch conversation');
        }
        return response.json();
    },

    // Update a conversation
    async updateConversation(oauthId: string, conversationId: string, data: UpdateConversationDto): Promise<Conversation> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update conversation');
        }
        return response.json();
    },

    // Delete a conversation
    async deleteConversation(oauthId: string, conversationId: string): Promise<void> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}`, {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete conversation');
        }
    },

    // Add a message to a conversation
    async addMessage(oauthId: string, conversationId: string, data: AddMessageDto): Promise<Message> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add message');
        }
        return response.json();
    },

    // Get messages for a conversation
    async getMessages(oauthId: string, conversationId: string): Promise<Message[]> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch messages');
        }
        return response.json();
    },

    // Toggle archive status
    async toggleArchive(oauthId: string, conversationId: string, archived: boolean): Promise<Conversation> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}/archive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to toggle archive');
        }
        return response.json();
    },

    // Delete a message
    async deleteMessage(oauthId: string, conversationId: string, messageId: string): Promise<void> {
        const response = await authenticatedFetch(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages/${messageId}`, {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete message');
        }
    },
};
