// Copy of each chat page's conversations, kept in localStorage per user and
// agent so a page can open on its sidebar and last chat at once instead of
// waiting for the API. The server's list always replaces it once it arrives.

type CachedChat = { lastUpdated: string; messages?: unknown[] }

const KEY_PREFIX = "conversation-cache:v1:"

// Messages kept per agent, counted in serialized characters. Every chat's
// title and dates are kept; messages only for the most recent chats that fit,
// so fourteen agents stay well inside the browser's storage quota.
const MESSAGE_BUDGET = 100_000

const keyFor = (userId: string, agentId: string) => `${KEY_PREFIX}${userId}:${agentId}`

export function readConversationCache<T extends CachedChat>(
  userId: string,
  agentId: string,
): Record<string, T> | null {
  try {
    const raw = localStorage.getItem(keyFor(userId, agentId))
    if (!raw) return null
    const chats = JSON.parse(raw) as Record<string, T>
    return Object.keys(chats).length > 0 ? chats : null
  } catch {
    return null
  }
}

export function writeConversationCache<T extends CachedChat>(
  userId: string,
  agentId: string,
  chats: Record<string, T>,
) {
  const key = keyFor(userId, agentId)
  const newestFirst = Object.entries(chats).sort(
    ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )

  let used = 0
  const trimmed: Record<string, T> = {}
  for (const [id, chat] of newestFirst) {
    const size = JSON.stringify(chat.messages ?? []).length
    if (used + size <= MESSAGE_BUDGET) {
      used += size
      trimmed[id] = chat
    } else {
      trimmed[id] = { ...chat, messages: [] }
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // Quota or blocked storage: drop the entry rather than leave an older copy behind.
    try {
      localStorage.removeItem(key)
    } catch {}
  }
}

/** Removes every user's cached chats, or all but `keepUserId`'s. */
export function clearConversationCaches(keepUserId?: string) {
  try {
    const keep = keepUserId ? `${KEY_PREFIX}${keepUserId}:` : null
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(KEY_PREFIX) && !(keep && key.startsWith(keep))) stale.push(key)
    }
    stale.forEach((key) => localStorage.removeItem(key))
  } catch {}
}

/**
 * Folds the server's chats into ones the user has already worked in since the
 * cached copy (`shown`) went on screen. A chat the user created or changed
 * keeps its local version, one they deleted stays deleted, and every other
 * chat takes the server's version.
 */
export function mergeServerChats<T>(
  current: Record<string, T>,
  shown: Record<string, T>,
  server: Record<string, T>,
): Record<string, T> {
  const merged = { ...server }
  for (const id of Object.keys(shown)) {
    if (!(id in current)) delete merged[id]
  }
  for (const [id, chat] of Object.entries(current)) {
    if (chat !== shown[id]) merged[id] = chat
  }
  return merged
}
