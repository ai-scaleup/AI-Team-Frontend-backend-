// Sara AI Module Types
// API endpoint types for /sara-ai/* routes

// ════════════════════════════════════════
// RESPONSE OBJECTS
// ════════════════════════════════════════

export interface StatsResponse {
    totalMessages: number;
    totalSessions: number;
    oldestMessage: string | null;
    newestMessage: string | null;
}

export interface ChatSession {
    phoneNumber: string;
    messageCount: number;
    lastMessageAt: string | null;
}

export interface SessionsResponse {
    sessions: ChatSession[];
    totalSessions: number;
}

export interface ChatMessage {
    id: number;
    sender: string;  // "user" | "ai" | "bot"
    text: string;
    createdAt: string;
}

export interface ConversationResponse {
    phoneNumber: string;
    messages: ChatMessage[];
    totalMessages: number;
}

// ════════════════════════════════════════
// ERROR OBJECT
// ════════════════════════════════════════

export interface SaraAiErrorResponse {
    statusCode: number;
    message: string;
    error: string;
}
