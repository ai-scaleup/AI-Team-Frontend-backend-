/**
 * Server-side bridge between the agent chat proxy and the compaction API.
 *
 * The agent workflows keep their live history in Redis, which the backend
 * cannot read, so the transcript it needs for a summary has to be reported to
 * it one turn at a time. This module is where that happens for every chat the
 * proxy forwards. Compaction is the backend's job alone: the n8n workflows do
 * none of it and only receive the finished summary inside a chat message.
 *
 * Nothing here is allowed to break a chat: every call is wrapped, every
 * failure is logged and swallowed, and the proxy carries on unchanged.
 */

import { API_BASE } from '@/lib/apiBase'
import { DEV_TOKEN_HEADER, getDevApiToken } from '@/lib/devToken'

/** Per-request timeout. A slow memory lookup must not delay the reply. */
const TIMEOUT_MS = 4000

export interface CompactionContext {
  enabled: boolean
  memoryBlock: string
  keepLastTurns: number
  liveTokens: number
  totalTokens: number
  conversationBudget: number
  percentOfBudget: number
  budgetExhausted: boolean
  summaryVersion: number
  /** The newest summary has not been handed to the workflow yet. */
  summaryPending: boolean
}

/** What the backend answers when a turn is reported. */
export interface CompactionTurnResult {
  /** A compaction is running for this chat. */
  compacting: boolean
  /** Where the chat stood before that compaction, to tell when it has landed. */
  compactionCount: number
  summaryVersion: number
  /** How far the chat is towards the token count at which it compacts, 0-100. */
  percentOfTrigger: number
}

export interface CompactionStatus {
  compacting: boolean
  compactionCount: number
  summaryVersion: number
  summaryPending: boolean
  liveTokens: number
  threshold: number
  percentOfTrigger: number
  lastCompactedAt: string | null
}

async function call<T>(path: string, init: RequestInit): Promise<T | null> {
  if (!API_BASE) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // These calls run on the Next server with no user session to forward, and
  // the backend authenticates every route, so they carry the development
  // token (DEV_API_TOKEN, server-side only). Without one the backend answers
  // 401 and the chat simply runs uncompacted.
  const devToken = getDevApiToken()

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // The backend base may be an ngrok tunnel during local testing.
        'ngrok-skip-browser-warning': 'true',
        ...(devToken ? { [DEV_TOKEN_HEADER]: devToken } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    })
    if (!response.ok) {
      console.error(`[compaction] ${path} returned ${response.status}`)
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    console.error(`[compaction] ${path} failed:`, error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The memory block to hand the workflow, or null when there is nothing to add. */
export function fetchCompactionContext(payload: {
  sessionId: string
  agent: string
  chatId?: string
  email?: string
  title?: string
}): Promise<CompactionContext | null> {
  return call<CompactionContext>('/compaction/context', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Reports a finished turn. The server appends it and, if the chat crossed its
 * watermark, starts writing a new summary in the background — which is why
 * this is called after the reply has already been streamed to the user.
 */
export function reportCompactionTurn(payload: {
  sessionId: string
  agent: string
  chatId?: string
  email?: string
  title?: string
  userText?: string
  aiText?: string
  // Real provider usage when the caller has it. The server falls back to its
  // own estimate when these are absent, which is the n8n case.
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  // The summary version this turn's message carried to the workflow, so the
  // server stops offering it.
  deliveredSummaryVersion?: number
  // Ask the server to mark the compaction in the chat's own transcript.
  notifyChat?: boolean
}): Promise<CompactionTurnResult | null> {
  return call<CompactionTurnResult>('/compaction/turn', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Where a chat's compaction stands, for the page that shows it running. */
export function fetchCompactionStatus(payload: {
  sessionId: string
  agent: string
  chatId?: string
}): Promise<CompactionStatus | null> {
  return call<CompactionStatus>('/compaction/status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Pulls the assistant's text out of the chat trigger's streaming response.
 *
 * n8n streams newline-delimited JSON objects, optionally SSE-prefixed, where
 * the `item` chunks carry the answer. Anything unparseable is skipped: this
 * runs only to feed the summary, so a malformed chunk costs nothing.
 */
export function extractStreamedText(raw: string): string {
  let text = ''

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/^data:\s?/, '').trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as { type?: string; content?: string }
      if (parsed.type === 'item' && typeof parsed.content === 'string') {
        text += parsed.content
      }
    } catch {
      // Not a JSON chunk — ignore it.
    }
  }

  return text.trim()
}
