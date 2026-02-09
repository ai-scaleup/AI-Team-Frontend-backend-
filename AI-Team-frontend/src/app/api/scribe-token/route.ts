import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const apiKey = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { error: 'ElevenLabs API key not configured' },
                { status: 500 }
            )
        }

        const response = await fetch(
            'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('ElevenLabs API error:', errorText)
            return NextResponse.json(
                { error: 'Failed to generate token' },
                { status: response.status }
            )
        }

        const data = await response.json()

        return NextResponse.json({ token: data.token })
    } catch (error) {
        console.error('Error generating scribe token:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
