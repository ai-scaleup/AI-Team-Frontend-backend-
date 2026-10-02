import * as React from "react"
import {
  mergeServerChats,
  readConversationCache,
  writeConversationCache,
} from "@/lib/conversationCache"

type CachedChat = { lastUpdated: string; messages?: unknown[] }

/**
 * Keeps a chat page's conversations cached on this device (see
 * lib/conversationCache) and saves them whenever `chats` changes.
 *
 * A page shows `read()` straight away and passes it to `markShown`. When the
 * server's list arrives, `reconcile` returns null if the user hasn't touched
 * anything since, so the page shows the server's list as usual; otherwise it
 * returns that list merged into the chats the user is already working in.
 */
export function useConversationCache<T extends CachedChat>(
  userId: string | undefined,
  agentId: string,
  chats: Record<string, T>,
  currentChatId: string | null,
) {
  const latest = React.useRef({ chats, currentChatId })
  const shown = React.useRef<{ chats: Record<string, T>; currentChatId: string } | null>(null)

  React.useEffect(() => {
    latest.current = { chats, currentChatId }
  }, [chats, currentChatId])

  React.useEffect(() => {
    if (userId && Object.keys(chats).length > 0) writeConversationCache(userId, agentId, chats)
  }, [userId, agentId, chats])

  return React.useMemo(
    () => ({
      read: () => (userId ? readConversationCache<T>(userId, agentId) : null),
      markShown: (shownChats: Record<string, T>, shownChatId: string) => {
        shown.current = { chats: shownChats, currentChatId: shownChatId }
      },
      reconcile: (server: Record<string, T>): Record<string, T> | null => {
        const before = shown.current
        shown.current = null
        if (!before) return null
        const now = latest.current
        if (now.chats === before.chats && now.currentChatId === before.currentChatId) return null
        return mergeServerChats(now.chats, before.chats, server)
      },
    }),
    [userId, agentId],
  )
}
