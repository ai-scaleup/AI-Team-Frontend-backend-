import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchCompactionStatus } from '@/lib/compactionBridge'

/**
 * Where a chat's compaction stands. A chat page polls this after the proxy
 * told it a compaction started, until the new summary has landed.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { sessionId?: string; agent?: string; chatId?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload?.sessionId || !payload.agent) {
    return NextResponse.json({ error: 'sessionId and agent are required' }, { status: 400 })
  }

  const status = await fetchCompactionStatus({
    sessionId: payload.sessionId,
    agent: payload.agent,
    chatId: payload.chatId,
  })
  if (!status) {
    return NextResponse.json({ error: 'Compaction status is unavailable' }, { status: 502 })
  }

  return NextResponse.json(status)
}
