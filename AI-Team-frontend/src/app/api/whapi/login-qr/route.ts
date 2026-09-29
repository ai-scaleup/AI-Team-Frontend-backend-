import { NextResponse } from 'next/server'
import { requireSignedIn } from '@/lib/requireSignedIn'

export const dynamic = 'force-dynamic'

/**
 * Fetches the WhatsApp login QR code from WHAPI with the server-held token and
 * returns WHAPI's JSON unchanged, so the token never reaches the browser.
 */
export async function GET() {
    const unauthorized = await requireSignedIn()
    if (unauthorized) return unauthorized

    try {
        const token = process.env.WHAPI_TOKEN || process.env.NEXT_PUBLIC_WHAPI_TOKEN

        if (!token) {
            return NextResponse.json(
                { error: 'WHAPI token not configured' },
                { status: 500 }
            )
        }

        const response = await fetch('https://gate.whapi.cloud/users/login', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        })

        const body = await response.text()
        return new Response(body, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Error fetching WHAPI login QR:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
