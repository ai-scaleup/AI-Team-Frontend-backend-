import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Summarises a conversation that has run out of token budget, so the chat that
// replaces it can carry the context forward instead of starting cold.
//
// Runs on the server: the key is only read here, never shipped to the browser,
// even though it carries the NEXT_PUBLIC_ prefix for historical reasons.

// Long chats are the ones that hit the limit, and the whole transcript is
// rarely needed to summarise it -- the tail carries the state that matters.
const MAX_MESSAGES = 60
const MAX_CHARS_PER_MESSAGE = 4000

const SYSTEM_PROMPT = `Sei un assistente che riassume conversazioni di lavoro tra un utente e un agente AI.

Scrivi un riassunto in italiano, in seconda persona rivolto all'agente, che permetta di riprendere la conversazione senza perdere contesto. Includi:
- l'obiettivo dell'utente e il progetto o cliente di cui si parla
- le decisioni prese e le informazioni concrete raccolte (nomi, numeri, budget, date, preferenze)
- il punto esatto in cui la conversazione si è interrotta e il prossimo passo previsto

Sii conciso ma non omettere dati concreti. Massimo 300 parole. Non inventare nulla che non sia nella conversazione.`

type IncomingMessage = {
    sender?: string
    text?: string
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env file' },
                { status: 500 }
            )
        }

        const { messages = [] } = await request.json()

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'messages is required and must be a non-empty array' },
                { status: 400 }
            )
        }

        const transcript = (messages as IncomingMessage[])
            .filter((message) => typeof message?.text === 'string' && message.text.trim())
            .slice(-MAX_MESSAGES)
            .map((message) => {
                const who = message.sender === 'user' ? 'Utente' : 'Agente'
                return `${who}: ${message.text!.trim().slice(0, MAX_CHARS_PER_MESSAGE)}`
            })
            .join('\n\n')

        if (!transcript) {
            return NextResponse.json(
                { error: 'No message text to summarise' },
                { status: 400 }
            )
        }

        const openai = new OpenAI({ apiKey })

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Riassumi questa conversazione:\n\n${transcript}` },
            ],
            temperature: 0.3,
            max_tokens: 600,
        })

        const summary = completion.choices[0]?.message?.content?.trim()

        if (!summary) {
            return NextResponse.json(
                { error: 'The model returned an empty summary' },
                { status: 502 }
            )
        }

        return NextResponse.json({ summary, usage: completion.usage })

    } catch (error: any) {
        console.error('Conversation summary error:', error)

        if (error.status === 401) {
            return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 })
        }

        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
