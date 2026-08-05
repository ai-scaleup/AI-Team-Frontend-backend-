export interface Message {
    id?: string;
    text: string;
    sender: 'user' | 'ai';
    time: string; // Display time e.g. "10:30"
    createdAt?: string; // ISO String
    conversationId?: string;
    files?: string[];
    raw?: string;
}

export interface Conversation {
    id: string;
    title: string;
    agentId: string;
    sessionId: string;
    userId?: string; // DB user ID or similar
    folderId?: string | null;
    archived: boolean;
    createdAt?: string;
    lastUpdated: string;
    messages?: Message[];
    // Token budget for this conversation. Stamped from the user's limit when the
    // conversation is created and moved by the n8n workflow after each run, so
    // the frontend only ever reads these. Null means no limit was assigned.
    tokenLimit?: number | null;
    tokenUsed?: number | null;
    tokenLeft?: number | null;
}

// DTOs
export interface CreateConversationDto {
    id: string;
    title: string;
    agentId: string;
    sessionId: string;
    folderId?: string | null;
    archived?: boolean;
    messages?: Partial<Message>[];
}

export interface UpdateConversationDto {
    title?: string;
    folderId?: string | null;
    archived?: boolean;
    lastUpdated?: string;
}

export interface AddMessageDto {
    text: string;
    sender: 'user' | 'ai';
    time?: string;
    files?: string[];
}
