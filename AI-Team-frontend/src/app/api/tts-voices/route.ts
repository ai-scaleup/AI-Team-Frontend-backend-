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

        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': apiKey,
            },
        })

        if (!response.ok) {
            throw new Error('Failed to fetch voices')
        }

        const data = await response.json()

        // Filter for Italian or multilingual voices
        const voices = data.voices.map((voice: any) => ({
            voice_id: voice.voice_id,
            name: voice.name,
            labels: voice.labels,
            preview_url: voice.preview_url,
            category: voice.category,
        }))

        return NextResponse.json({ voices })
    } catch (error: any) {
        console.error('Error fetching TTS voices:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
