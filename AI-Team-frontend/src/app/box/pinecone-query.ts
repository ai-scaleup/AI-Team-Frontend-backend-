/**
 * Pinecone Query Utility for Giulia AI Chat
 * Queries the appropriate namespace to get relevant context for RAG
 */

export interface PineconeMatch {
    id: string;
    score: number;
    metadata?: {
        text?: string;
        source?: string;
        [key: string]: any;
    };
}

export interface PineconeQueryResult {
    matches: PineconeMatch[];
}

/**
 * Query Pinecone for relevant context based on user message
 */
export async function queryPineconeForContext(
    userMessage: string,
    namespace: string,
    topK: number = 3
): Promise<string> {
    try {
        // Embedding and the Pinecone query run server-side so the OpenAI and
        // Pinecone keys never reach the browser.
        const response = await fetch('/api/public/box/rag-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage, namespace, topK }),
        });

        if (!response.ok) {
            console.error('RAG context lookup error:', response.status);
            return '';
        }

        const data: { context?: string } = await response.json();
        return data.context ?? '';
    } catch (error) {
        console.error('Error querying Pinecone:', error);
        return '';
    }
}
