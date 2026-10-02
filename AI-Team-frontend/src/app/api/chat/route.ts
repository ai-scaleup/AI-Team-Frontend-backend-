import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchCompactionContext, reportCompactionTurn } from '@/lib/compactionBridge'

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env file' },
                { status: 500 }
            )
        }

        const { message, conversationHistory = [], sessionId, chatId } = await request.json()

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            )
        }

        const openai = new OpenAI({ apiKey })

        // Unlike the n8n agents, this route builds its own messages array, so the
        // summary of the older turns goes where it belongs: in the system prompt.
        const compaction = sessionId
            ? await fetchCompactionContext({ sessionId, agent: 'luca-ai', chatId })
            : null

        // Build messages array for OpenAI
        const messages: any[] = [
            {
                role: 'system',
                content: `Sei Luca AI, un assistente virtuale professionale e amichevole che parla italiano. 
Sei parte di un team di AI specializzati che aiutano le aziende con marketing, vendite e strategia.
Rispondi in modo chiaro, conciso e utile. Mantieni un tono professionale ma cordiale.
Le tue risposte devono essere brevi (2-3 frasi) per facilitare la conversazione vocale.${compaction?.memoryBlock ? `

${compaction.memoryBlock}` : ''}`
            },
            ...conversationHistory,
            {
                role: 'user',
                content: message
            }
        ]

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // Fast and cost-effective for conversations
            messages,
            temperature: 0.7,
            max_tokens: 150, // Keep responses concise for voice
        })

        const aiResponse = completion.choices[0]?.message?.content || 'Mi dispiace, non ho capito.'

        if (sessionId) {
            void reportCompactionTurn({
                sessionId,
                agent: 'luca-ai',
                chatId,
                userText: message,
                aiText: aiResponse,
                promptTokens: completion.usage?.prompt_tokens,
                completionTokens: completion.usage?.completion_tokens,
                totalTokens: completion.usage?.total_tokens,
            })
        }

        return NextResponse.json({
            response: aiResponse,
            usage: completion.usage
        })

    } catch (error: any) {
        console.error('OpenAI API error:', error)

        if (error.status === 401) {
            return NextResponse.json(
                { error: 'Invalid OpenAI API key' },
                { status: 401 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
