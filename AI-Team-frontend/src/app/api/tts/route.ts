import { NextRequest, NextResponse } from 'next/server'
import { requireSignedIn } from '@/lib/requireSignedIn'

// Matilda (multilingual, works well with Italian)
const DEFAULT_VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'
const MAX_TEXT_LENGTH = 5000

/**
 * Text-to-speech proxy: streams ElevenLabs audio (audio/mpeg) back to the
 * browser so the ElevenLabs key never leaves the server.
 */
export async function POST(request: NextRequest) {
    const unauthorized = await requireSignedIn()
    if (unauthorized) return unauthorized

    try {
        const apiKey = process.env.ELEVEN_LABS_API_KEY || process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { error: 'ElevenLabs API key not configured' },
                { status: 500 }
            )
        }

        const body = await request.json()
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        const voiceId =
            typeof body?.voiceId === 'string' && /^[A-Za-z0-9]+$/.test(body.voiceId)
                ? body.voiceId
                : DEFAULT_VOICE_ID

        if (!text || text.length > MAX_TEXT_LENGTH) {
            return NextResponse.json(
                { error: `Text must be 1-${MAX_TEXT_LENGTH} characters` },
                { status: 400 }
            )
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'audio/mpeg',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2_5',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            }
        )

        if (!response.ok || !response.body) {
            const errorText = await response.text().catch(() => '')
            console.error('ElevenLabs TTS error:', errorText)
            return NextResponse.json(
                { error: 'Failed to generate speech' },
                { status: response.status || 502 }
            )
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Error generating speech:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
