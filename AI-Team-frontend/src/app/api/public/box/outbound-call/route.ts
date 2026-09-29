import { NextRequest, NextResponse } from 'next/server'

/**
 * Starts an NLPearl outbound call for a /box landing-page lead. The Pearl ID
 * and API key stay on the server; only the lead's details come from the page.
 */
export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.NLPEARL_API_KEY || process.env.NEXT_PUBLIC_NLPEARL_API_KEY
        const pearlId = process.env.PEARL_ID || process.env.NEXT_PUBLIC_PEARL_ID

        if (!apiKey || !pearlId) {
            return NextResponse.json(
                { error: 'NLPearl is not configured' },
                { status: 500 }
            )
        }

        const body = await request.json()
        const phoneNumber = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
        const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 320) : ''
        const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''

        if (!/^\+?\d{6,16}$/.test(phoneNumber)) {
            return NextResponse.json(
                { error: 'Invalid phone number' },
                { status: 400 }
            )
        }

        const response = await fetch(
            `https://api.nlpearl.ai/v2/Outbound/${encodeURIComponent(pearlId)}/Lead`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    phoneNumber,
                    externalId: Date.now().toString(),
                    timeZoneId: 'Europe/Rome',
                    callData: { email, name },
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            console.error('NLPearl outbound call error:', errorText)
            return NextResponse.json(
                { error: 'Call API failed' },
                { status: response.status }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error starting outbound call:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
