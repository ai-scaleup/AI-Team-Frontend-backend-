import { z } from 'zod';

// Message schema
export const messageSchema = z.object({
    text: z.string().min(1, { message: 'Message text is required.' }),
    sender: z.enum(['ai', 'user'], { message: 'Sender must be "ai" or "user".' }),
    time: z.string().optional(), // Optional - will be auto-generated if not provided
});

// Schema for creating a conversation
export const createConversationSchema = z.object({
    id: z.string().min(1, { message: 'Conversation ID is required.' }), // e.g., "chat_1765435414978"
    title: z.string().min(1, { message: 'Title is required.' }),
    agentId: z.string().min(1, { message: 'Agent ID is required.' }),
    sessionId: z.string().min(1, { message: 'Session ID is required.' }),
    folderId: z.string().optional().nullable(),
    archived: z.boolean().optional().default(false),
    messages: z.array(messageSchema).optional().default([]),
});

// Schema for updating a conversation
export const updateConversationSchema = z.object({
    title: z.string().min(1).optional(),
    folderId: z.string().optional().nullable(),
    archived: z.boolean().optional(),
    lastUpdated: z.string().datetime().optional(),
});

// Schema for adding a message to a conversation
export const addMessageSchema = messageSchema;

// Infer TypeScript types from schemas
export type MessageDto = z.infer<typeof messageSchema>;
export type CreateConversationDto = z.infer<typeof createConversationSchema>;
export type UpdateConversationDto = z.infer<typeof updateConversationSchema>;
export type AddMessageDto = z.infer<typeof addMessageSchema>;
