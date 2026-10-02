"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { registerApiTokenGetter } from "@/lib/authenticatedFetch";
import { clearConversationCaches } from "@/lib/conversationCache";

export default function ApiAuthBridge() {
  const { getToken, isLoaded, userId } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      return registerApiTokenGetter(getToken);
    }
  }, [getToken, isLoaded]);

  // Chats cached on this device belong to whoever is signed in; drop them on
  // sign-out and when another account signs in.
  useEffect(() => {
    if (isLoaded) {
      clearConversationCaches(userId ?? undefined);
    }
  }, [isLoaded, userId]);

  return null;
}
