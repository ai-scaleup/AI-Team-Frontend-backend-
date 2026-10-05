import { API_BASE } from "@/lib/apiBase"
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import { Conversation, Message, CreateConversationDto, UpdateConversationDto, AddMessageDto } from '@/types/conversation';
import { isUserSynced, waitForUserSync } from '@/lib/userSyncGate';


// Conversations still being created on the server, by id. A chat page creates the
// welcome conversation in the background, so a fast first message could reach
// addMessage before the conversation exists and its save would fail.
const pendingCreates = new Map<string, Promise<unknown>>();

// The server finds the user by email when one is given, and by OAuth ID
// otherwise. A page that passes the signed-in email sees the same
// conversations whichever Clerk ID that email is signed in under.
const withEmail = (url: string, email?: string | null) =>
    email ? `${url}${url.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}` : url;

export const conversationService = {
    // Create or Upsert a conversation
    createConversation(oauthId: string, data: CreateConversationDto, email?: string | null): Promise<Conversation> {
        const request = (async (): Promise<Conversation> => {
            await waitForUserSync();
            const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}`, email), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create conversation');
            }
            return response.json();
        })();

        pendingCreates.set(data.id, request);
        const clear = () => {
            if (pendingCreates.get(data.id) === request) pendingCreates.delete(data.id);
        };
        request.then(clear, clear);
        return request;
    },

    // Get all conversations for a user
    async getConversations(oauthId: string, agentId?: string, email?: string | null): Promise<Conversation[]> {
        const url = withEmail(
            agentId
                ? `${API_BASE}/conversations/${oauthId}?agentId=${agentId}`
                : `${API_BASE}/conversations/${oauthId}`,
            email,
        );
        // Ask straight away: a returning user already exists on the server, so
        // only a first sign-in, whose account UserSync is still creating, has
        // to wait for the sync and ask again.
        let response = await authenticatedFetch(url);
        if (response.status === 404 && !isUserSynced()) {
            await waitForUserSync();
            response = await authenticatedFetch(url);
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch conversations');
        }
        return response.json();
    },

    // Get a single conversation
    async getConversation(oauthId: string, conversationId: string, email?: string | null): Promise<Conversation> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}`, email));
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch conversation');
        }
        return response.json();
    },

    // Update a conversation
    async updateConversation(oauthId: string, conversationId: string, data: UpdateConversationDto, email?: string | null): Promise<Conversation> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}`, email), {
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
    async deleteConversation(oauthId: string, conversationId: string, email?: string | null): Promise<void> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}`, email), {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete conversation');
        }
    },

    // Add a message to a conversation
    async addMessage(oauthId: string, conversationId: string, data: AddMessageDto, email?: string | null): Promise<Message> {
        // Wait for the conversation to exist; a failed create surfaces on its own caller.
        await pendingCreates.get(conversationId)?.catch(() => {});
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages`, email), {
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
    async getMessages(oauthId: string, conversationId: string, email?: string | null): Promise<Message[]> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages`, email));
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch messages');
        }
        return response.json();
    },

    // Toggle archive status
    async toggleArchive(oauthId: string, conversationId: string, archived: boolean, email?: string | null): Promise<Conversation> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}/archive`, email), {
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
    async deleteMessage(oauthId: string, conversationId: string, messageId: string, email?: string | null): Promise<void> {
        const response = await authenticatedFetch(withEmail(`${API_BASE}/conversations/${oauthId}/${conversationId}/messages/${messageId}`, email), {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete message');
        }
    },
};
