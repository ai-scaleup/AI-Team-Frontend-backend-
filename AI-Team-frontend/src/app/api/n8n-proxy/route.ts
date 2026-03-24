import { NextRequest, NextResponse } from 'next/server'

const N8N_ENDPOINTS: Record<string, string> = {
  'alex-ai': process.env.ALEX_AI_N8N_ENDPOINT || 'https://n8n-c2lq.onrender.com/webhook/65c03f65-d13c-43c7-967d-708dcceef965/chat?action=sendMessage',
}

export async function POST(request: NextRequest) {
  const agent = request.nextUrl.searchParams.get('agent')

  if (!agent || !N8N_ENDPOINTS[agent]) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }

  const body = await request.text()

  let n8nResponse: Response
  try {
    n8nResponse = await fetch(N8N_ENDPOINTS[agent], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (error) {
    console.error(`[n8n-proxy] fetch failed for ${agent}:`, error)
    return NextResponse.json({ error: 'Failed to reach n8n' }, { status: 502 })
  }

  if (!n8nResponse.ok) {
    return NextResponse.json({ error: `n8n returned ${n8nResponse.status}` }, { status: n8nResponse.status })
  }

  const contentType = n8nResponse.headers.get('Content-Type') || 'text/event-stream'

  return new NextResponse(n8nResponse.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
