import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const MAX_PROMPT_LENGTH = 60000

/**
 * Gemini proxy for the public /box landing-page chats. The model is fixed
 * here and the key stays on the server; Gemini's JSON is returned unchanged.
 */
export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            )
        }

        const body = await request.json()
        const prompt = typeof body?.prompt === 'string' ? body.prompt : ''

        if (!prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
            return NextResponse.json(
                { error: 'Invalid prompt' },
                { status: 400 }
            )
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
        )

        const data = await response.json().catch(() => ({}))
        return NextResponse.json(data, { status: response.status })
    } catch (error) {
        console.error('Error calling Gemini:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
