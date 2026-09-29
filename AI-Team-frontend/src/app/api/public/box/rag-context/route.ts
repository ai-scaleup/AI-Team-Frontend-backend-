import { NextRequest, NextResponse } from 'next/server'
import { pineconeConfig } from '@/app/dashboard/knowledgebase/_lib/pineconeServer'

const MAX_MESSAGE_LENGTH = 4000
const MAX_TOP_K = 10

/** Only the /box product knowledge bases may be read from this public route. */
function allowedNamespaces(): Set<string> {
    return new Set([
        process.env.BUSINESS_NAMESPACE || process.env.NEXT_PUBLIC_BUSINESS_NAMESPACE || 'business-ai',
        process.env.CARRIERA_NAMESPACE || process.env.NEXT_PUBLIC_CARRIERA_NAMESPACE || 'carriera-ai',
    ])
}

/**
 * RAG lookup for the /box landing-page chats: embeds the user's message and
 * returns the matching knowledge-base text, keeping the OpenAI and Pinecone
 * keys on the server.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const message = typeof body?.message === 'string' ? body.message.trim() : ''
        const namespace = typeof body?.namespace === 'string' ? body.namespace.trim() : ''
        const topK = Math.min(Math.max(Number(body?.topK) || 3, 1), MAX_TOP_K)

        if (!message || message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
        }
        if (!allowedNamespaces().has(namespace)) {
            return NextResponse.json({ error: 'Forbidden namespace' }, { status: 403 })
        }

        const openAiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
        if (!openAiKey) {
            return NextResponse.json({ error: 'OpenAI is not configured' }, { status: 500 })
        }

        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-large',
                input: message,
            }),
        })

        if (!embeddingResponse.ok) {
            console.error('OpenAI embedding error:', embeddingResponse.status)
            return NextResponse.json({ error: 'Embedding failed' }, { status: 502 })
        }

        const embeddingData = await embeddingResponse.json()
        const embedding = embeddingData?.data?.[0]?.embedding

        const { base, apiKey } = await pineconeConfig('shared')
        const queryResponse = await fetch(`${base}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
            },
            body: JSON.stringify({
                vector: embedding,
                topK,
                namespace,
                includeMetadata: true,
            }),
        })

        if (!queryResponse.ok) {
            console.error('Pinecone query error:', queryResponse.status)
            return NextResponse.json({ error: 'Pinecone query failed' }, { status: 502 })
        }

        const queryResult = await queryResponse.json()
        const matches: { metadata?: { text?: unknown } }[] = Array.isArray(queryResult?.matches)
            ? queryResult.matches
            : []
        const context = matches
            .map((match) => match.metadata?.text)
            .filter((text): text is string => typeof text === 'string' && text.length > 0)
            .join('\n\n')

        return NextResponse.json({ context })
    } catch (error) {
        console.error('Error querying Pinecone:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
