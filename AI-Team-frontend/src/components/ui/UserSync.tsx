"use client"

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { markUserSynced } from "@/lib/userSyncGate"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE

export default function UserSync() {
  const { user, isLoaded } = useUser()
  const synced = useRef(false)

  useEffect(() => {
    if (!isLoaded || !user || synced.current) return

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) return

    synced.current = true

    const username = user.fullName?.trim() || user.username?.trim() || undefined

    authenticatedFetch(`${API_BASE}/users/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oauthId: user.id, email, username }),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("[UserSync] sync failed:", res.status)
          synced.current = false
        }

        markUserSynced()
      })
      .catch(() => {
        console.error("[UserSync] sync network error")
        synced.current = false
        markUserSynced()
      })
  }, [isLoaded, user])

  return null
}
