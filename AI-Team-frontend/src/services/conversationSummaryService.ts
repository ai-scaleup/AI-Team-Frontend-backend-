import { conversationService } from '@/services/conversationService';
import type { Message } from '@/types/conversation';

// Builds the hand-over summary used when a conversation runs out of token
// budget and has to be replaced by a fresh one.

// Marks the summary inside the first prompt of the new conversation, so the
// agent can tell carried-over context from what the user just typed.
export const SUMMARY_PROMPT_LABEL = 'RIEPILOGO_CONVERSAZIONE_PRECEDENTE';

// Shown in the new chat above the summary so the user knows why it is there.
export const SUMMARY_MESSAGE_HEADING = '📝 **Riepilogo della conversazione precedente**';

export const conversationSummaryService = {
    // Reads the conversation's messages and summarises them. Prefers the stored
    // transcript (the local one can be trimmed to what is on screen) and falls
    // back to whatever the caller already has.
    async summarizeConversation(
        oauthId: string | null | undefined,
        conversationId: string,
        fallbackMessages: Message[] = [],
    ): Promise<string | null> {
        let messages: Message[] = fallbackMessages;

        if (oauthId) {
            try {
                const stored = await conversationService.getMessages(oauthId, conversationId);
                if (stored && stored.length > 0) messages = stored;
            } catch {
                // Falls back to what the page has in state.
            }
        }

        const usable = messages.filter((message) => message?.text?.trim());
        if (usable.length === 0) return null;

        try {
            const response = await fetch('/api/summarize-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: usable.map((message) => ({
                        sender: message.sender,
                        text: message.text,
                    })),
                }),
            });

            if (!response.ok) return null;

            const payload = await response.json();
            return typeof payload?.summary === 'string' && payload.summary.trim()
                ? payload.summary.trim()
                : null;
        } catch {
            // A failed summary must not block the user from starting the new
            // conversation -- they just start it without carried context.
            return null;
        }
    },
};
