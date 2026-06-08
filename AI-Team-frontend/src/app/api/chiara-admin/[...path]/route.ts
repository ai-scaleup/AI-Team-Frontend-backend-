import { NextRequest, NextResponse } from 'next/server'

const CHIARA_API_URL = process.env.CHIARA_API_URL || 'https://chiara-backend.onrender.com'
const CHIARA_ADMIN_TOKEN = process.env.CHIARA_ADMIN_TOKEN || ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params, 'POST')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params, 'PATCH')
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
): Promise<NextResponse> {
  const pathSegments = params.path ?? []
  const upstreamPath = '/' + pathSegments.join('/')
  const search = request.nextUrl.search
  const upstreamUrl = `${CHIARA_API_URL}${upstreamPath}${search}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${CHIARA_ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
  }

  let body: string | undefined
  if (method === 'POST' || method === 'PATCH') {
    body = await request.text()
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, { method, headers, body })
  } catch (error) {
    console.error('[chiara-admin proxy] fetch error:', error)
    return NextResponse.json({ error: 'Failed to reach Chiara backend' }, { status: 502 })
  }

  const data = await upstream.json().catch(() => null)
  return NextResponse.json(data ?? {}, { status: upstream.status })
}
