import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import {
  extractStreamedText,
  fetchCompactionContext,
  reportCompactionTurn,
} from '@/lib/compactionBridge'

/**
 * Server-side proxy for the n8n agent webhooks.
 *
 * Webhook URLs are read from server-only environment variables (no
 * NEXT_PUBLIC_ prefix) so they never reach the browser bundle. Each entry maps
 * the agent slug used by the dashboard pages to the env var holding its URL.
 */
const N8N_ENV_VARS: Record<string, string> = {
  'aladino-ai': 'ALADINO_AI_N8N_ENDPOINT',
  'alex-ai': 'ALEX_AI_N8N_ENDPOINT',
  'dan-ai': 'DAN_AI_N8N_ENDPOINT',
  'daniele-ai': 'DANIELE_AI_N8N_ENDPOINT',
  'jim-ai': 'JIM_AI_N8N_ENDPOINT',
  'lara-ai': 'LARA_AI_N8N_ENDPOINT',
  'laura-ai': 'LAURA_AI_N8N_ENDPOINT',
  'max-ai': 'MAX_AI_N8N_ENDPOINT',
  'mike-ai': 'MIKE_AI_N8N_ENDPOINT',
  'niko-ai': 'NIKO_AI_N8N_ENDPOINT',
  'roberta-ai': 'ROBERTA_AI_N8N_ENDPOINT',
  'simone-ai': 'SIMONE_AI_N8N_ENDPOINT',
  'sofia-ai': 'SOFIA_AI_N8N_ENDPOINT',
  'tony-ai': 'TONY_AI_N8N_ENDPOINT',
  'valentina-ai': 'VALENTINA_AI_N8N_ENDPOINT',
  'test-aladino-ai': 'TEST_ALADINO_AI_N8N_ENDPOINT',
  'test-alex-ai': 'TEST_ALEX_AI_N8N_ENDPOINT',
  'test-daniele-ai': 'TEST_DANIELE_AI_N8N_ENDPOINT',
  'test-jim-ai': 'TEST_JIM_AI_N8N_ENDPOINT',
  'test-lara-ai': 'TEST_LARA_AI_N8N_ENDPOINT',
  'test-mike-ai': 'TEST_MIKE_AI_N8N_ENDPOINT',
  'test-niko-ai': 'TEST_NIKO_AI_N8N_ENDPOINT',
  'test-simone-ai': 'TEST_SIMONE_AI_N8N_ENDPOINT',
  'test-tony-ai': 'TEST_TONY_AI_N8N_ENDPOINT',
  'sara-ai': 'SARA_AI_N8N_ENDPOINT',
  'test-valentina-ai': 'TEST_VALENTINA_AI_N8N_ENDPOINT',
  'test-valentina-ai-history': 'TEST_VALENTINA_AI_HISTORY_N8N_ENDPOINT',
  'giulia-widget': 'GIULIA_WIDGET_N8N_ENDPOINT',
  'jennifer-widget': 'JENNIFER_WIDGET_N8N_ENDPOINT',
}

/**
 * Proxy targets that compaction leaves alone: the two floating widgets, which
 * are short public chats with no AgentName behind them, and the history
 * endpoint, which fetches a transcript rather than taking a turn. Listing them
 * keeps the proxy from asking the backend about something it will reject.
 */
const COMPACTION_EXCLUDED = new Set([
  'giulia-widget',
  'jennifer-widget',
  'test-valentina-ai-history',
])

function resolveEndpoint(agent: string | null): string | null {
  if (!agent) return null
  const envVar = N8N_ENV_VARS[agent]
  if (!envVar) return null
  return process.env[envVar] || null
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET')
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST')
}

async function proxy(request: NextRequest, method: 'GET' | 'POST') {
  // Only signed-in users may reach the workflows. The dashboard already
  // requires a Clerk session; this keeps the proxy from being an open relay
  // for anyone who discovers the route.
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = request.nextUrl.searchParams.get('agent')
  const endpoint = resolveEndpoint(agent)

  if (!endpoint) {
    const known = agent !== null && agent in N8N_ENV_VARS
    if (known) {
      console.error(`[n8n-proxy] ${N8N_ENV_VARS[agent!]} is not set`)
      return NextResponse.json({ error: 'Agent is not configured' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }

  const rawBody = method === 'POST' ? await request.text() : undefined

  // Parsed so the compaction memory can be added to it. A body that is not
  // JSON is forwarded exactly as it arrived.
  let payload: ChatPayload | null = null
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ChatPayload
    } catch {
      payload = null
    }
  }

  const compactionAgent =
    agent && !COMPACTION_EXCLUDED.has(agent) ? agent : null

  const email = payload && compactionAgent ? await resolveEmail(payload) : undefined

  // What the user actually wrote. The backend's copy of the transcript gets
  // this, not the message with a summary put in front of it.
  const userText = payload?.chatInput

  // Compaction runs in the backend only. When one has finished, its summary
  // rides along with the next message, once: the workflow keeps that message
  // in its own history, so sending it again would only repeat it.
  let body = rawBody
  let deliveredSummaryVersion: number | undefined
  if (payload?.sessionId && compactionAgent) {
    const context = await fetchCompactionContext({
      sessionId: payload.sessionId,
      agent: compactionAgent,
      chatId: payload.chatId,
      email,
    })

    // Every workflow takes its prompt from chatInput and ignores the rest, so
    // in front of the message is the one place the summary reaches the model
    // without editing a workflow in n8n.
    if (
      context?.summaryPending &&
      context.memoryBlock &&
      typeof payload.chatInput === 'string' &&
      payload.chatInput.trim()
    ) {
      payload.memoryBlock = context.memoryBlock
      payload.metadata = { ...(payload.metadata ?? {}), memoryBlock: context.memoryBlock }
      payload.chatInput = withMemoryBlock(payload.chatInput, context.memoryBlock)
      deliveredSummaryVersion = context.summaryVersion
      body = JSON.stringify(payload)
    }
  }

  let n8nResponse: Response
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // Optional shared secret so n8n can reject calls that do not come from this proxy.
    if (process.env.N8N_SHARED_SECRET) {
      headers['X-Agent-Secret'] = process.env.N8N_SHARED_SECRET
    }
    n8nResponse = await fetch(endpoint, { method, headers, body })
  } catch (error) {
    console.error(`[n8n-proxy] fetch failed for ${agent}:`, error)
    return NextResponse.json({ error: 'Failed to reach n8n' }, { status: 502 })
  }

  if (!n8nResponse.ok) {
    return NextResponse.json({ error: `n8n returned ${n8nResponse.status}` }, { status: n8nResponse.status })
  }

  const contentType = n8nResponse.headers.get('Content-Type') || 'text/event-stream'

  // The reply is streamed to the browser untouched; a copy is read alongside
  // it so the finished turn can be reported once the stream ends. Compaction
  // then happens behind the user's next message rather than in front of it.
  let stream: ReadableStream<Uint8Array> | null = n8nResponse.body
  if (stream && payload?.sessionId && compactionAgent) {
    const turn: ReportedTurn = {
      sessionId: payload.sessionId,
      agent: compactionAgent,
      chatId: payload.chatId,
      email,
      title: payload.title,
      userText,
      deliveredSummaryVersion,
    }

    if (request.nextUrl.searchParams.get('compactionEvents') === '1') {
      // A page that shows compaction asked to be told where the chat stands.
      stream = withCompactionEvent(stream, { ...turn, notifyChat: true })
    } else {
      const [toClient, toRecorder] = stream.tee()
      stream = toClient
      void recordTurn(toRecorder, turn)
    }
  }

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Puts the summary of the older turns in front of the user's message.
 *
 * The block already arrives labelled as established fact, so it needs only a
 * separator to keep it from reading as something the user typed. It travels
 * inside the message rather than as a system instruction because that is what
 * the workflows actually read. The agent's own Redis history stores it
 * alongside the message, which is why it is sent once per compaction; it rolls
 * off with that history's recency window like any other turn.
 */
function withMemoryBlock(chatInput: string, memoryBlock: string): string {
  const separator = "\n\n--- end of earlier conversation ---\n\n";
  return memoryBlock + separator + chatInput
}

/** The fields this proxy reads. Everything else is forwarded untouched. */
interface ChatPayload {
  chatInput?: string
  sessionId?: string
  chatId?: string
  title?: string
  metadata?: Record<string, unknown> & { email?: string }
  memoryBlock?: string
}

/** A finished turn, as it is reported to the backend. */
interface ReportedTurn {
  sessionId: string
  agent: string
  chatId?: string
  email?: string
  title?: string
  userText?: string
  deliveredSummaryVersion?: number
  notifyChat?: boolean
}

/**
 * The chat's email. Pages that already send one in `metadata` win; otherwise
 * it comes from the Clerk session, which is the same person either way.
 */
async function resolveEmail(payload: ChatPayload): Promise<string | undefined> {
  const fromPayload = payload.metadata?.email
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload.trim()

  try {
    const user = await currentUser()
    return user?.primaryEmailAddress?.emailAddress ?? undefined
  } catch {
    return undefined
  }
}

/** Drains the copied stream, then reports the turn. Never throws. */
async function recordTurn(stream: ReadableStream<Uint8Array>, turn: ReportedTurn) {
  try {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let raw = ''

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      raw += decoder.decode(value, { stream: true })
    }

    await reportTurn(raw, turn)
  } catch (error) {
    console.error('[compaction] failed to record the turn:', error)
  }
}

/** Reports the turn whose reply arrived as `raw`. Never throws. */
async function reportTurn(raw: string, turn: ReportedTurn) {
  try {
    const aiText = extractStreamedText(raw)
    if (!turn.userText && !aiText) return null

    return await reportCompactionTurn({ ...turn, aiText })
  } catch (error) {
    console.error('[compaction] failed to record the turn:', error)
    return null
  }
}

/**
 * Passes the reply through untouched and, once it has ended, reports the turn
 * before closing. One more line then follows the reply, in the format the
 * workflow streams, telling the page where the chat stands:
 *
 *   {"type":"compaction","status":"idle","percentOfTrigger":92,"compactionCount":0,"summaryVersion":0}
 *
 * `percentOfTrigger` lets the page warn that a compaction is coming. A status
 * of "started" means this turn set one off; the two counters are where the
 * chat stood before it, which is how the page tells the new summary has landed.
 */
function withCompactionEvent(
  source: ReadableStream<Uint8Array>,
  turn: ReportedTurn,
): ReadableStream<Uint8Array> {
  const reader = source.getReader()
  const decoder = new TextDecoder()
  let raw = ''

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read()
      if (!done) {
        raw += decoder.decode(value, { stream: true })
        controller.enqueue(value)
        return
      }

      const result = await reportTurn(raw, turn)
      if (result) {
        const event = {
          type: 'compaction',
          status: result.compacting ? 'started' : 'idle',
          percentOfTrigger: result.percentOfTrigger,
          compactionCount: result.compactionCount,
          summaryVersion: result.summaryVersion,
        }
        controller.enqueue(new TextEncoder().encode(`\n${JSON.stringify(event)}\n`))
      }
      controller.close()
    },
    // The browser went away mid-reply: keep what arrived for the transcript.
    async cancel(reason) {
      await reader.cancel(reason)
      void reportTurn(raw, turn)
    },
  })
}
