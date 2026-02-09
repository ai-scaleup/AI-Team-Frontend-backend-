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
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST;
    const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY;

    if (!OPENAI_API_KEY || !PINECONE_HOST || !PINECONE_API_KEY) {
        console.warn('Missing Pinecone/OpenAI configuration, skipping RAG');
        return '';
    }

    try {
        // Create embedding for the user message
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-large',
                input: userMessage,
            }),
        });

        if (!embeddingResponse.ok) {
            console.error('OpenAI embedding error');
            return '';
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Query Pinecone
        const queryResponse = await fetch(`${PINECONE_HOST}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': PINECONE_API_KEY,
            },
            body: JSON.stringify({
                vector: embedding,
                topK,
                namespace,
                includeMetadata: true,
            }),
        });

        if (!queryResponse.ok) {
            console.error('Pinecone query error');
            return '';
        }

        const queryResult: PineconeQueryResult = await queryResponse.json();

        // Extract text from matches
        const contextTexts = queryResult.matches
            .filter(match => match.metadata?.text)
            .map(match => match.metadata!.text!)
            .join('\n\n');

        return contextTexts;
    } catch (error) {
        console.error('Error querying Pinecone:', error);
        return '';
    }
}
