/**
 * Server-side lookup of the chat model a user's agent runs on.
 *
 * The model is chosen per team, membership or single-agent grant in the
 * admin panel. The n8n proxy asks the backend which one applies before it
 * forwards a message, so the browser never gets to pick a model: it can only
 * say which grant is paying, and the backend checks the user really holds
 * that grant before using its choice.
 *
 * Like the compaction bridge, nothing here may break a chat: a failed lookup
 * is logged and the message goes out without a model, and the workflow uses
 * its own fallback.
 */

import { API_BASE } from '@/lib/apiBase'
import { DEV_TOKEN_HEADER, getDevApiToken } from '@/lib/devToken'

/** A slow lookup must not hold up the reply. */
const TIMEOUT_MS = 4000

export interface ResolvedAgentModel {
  model: {
    id: string
    provider: string
    /** Exact id the provider's API expects, e.g. "claude-sonnet-5". */
    modelId: string
    label: string
    isDefault: boolean
    isActive: boolean
  }
  /**
   * The tier whose grant's own choice applies, or "default" for the catalog
   * default.
   */
  source: 'single-agent' | 'team' | 'membership' | 'default'
  teamId: string | null
  membershipAssignmentId: string | null
  singleAssignmentId: string | null
}

export async function fetchAgentModel(params: {
  email: string
  /** Backend enum, e.g. "ALEX". */
  agentName: string
  teamId?: string | null
  /** The assigned membership paying for the chat, when the membership tier pays. */
  membershipAssignmentId?: string | null
  /** The single-agent grant paying for the chat, when the single-agent tier pays. */
  singleAssignmentId?: string | null
  /** The signed-in user's Clerk token, used when no development token is set. */
  bearerToken?: string | null
}): Promise<ResolvedAgentModel | null> {
  if (!API_BASE) return null

  const query = new URLSearchParams({ email: params.email, agentName: params.agentName })
  if (params.teamId) query.set('teamId', params.teamId)
  if (params.membershipAssignmentId) query.set('membershipAssignmentId', params.membershipAssignmentId)
  if (params.singleAssignmentId) query.set('singleAssignmentId', params.singleAssignmentId)

  const devToken = getDevApiToken()
  const headers: Record<string, string> = {
    // The backend base may be an ngrok tunnel during local testing.
    'ngrok-skip-browser-warning': 'true',
  }
  if (devToken) headers[DEV_TOKEN_HEADER] = devToken
  else if (params.bearerToken) headers.Authorization = `Bearer ${params.bearerToken}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/admin/llm-models/resolve?${query}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      console.error(`[agent-model] resolve returned ${response.status}`)
      return null
    }
    return (await response.json()) as ResolvedAgentModel
  } catch (error) {
    console.error('[agent-model] resolve failed:', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}
