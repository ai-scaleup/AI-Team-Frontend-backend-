"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { registerApiTokenGetter } from "@/lib/authenticatedFetch";

export default function ApiAuthBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      return registerApiTokenGetter(getToken);
    }
  }, [getToken, isLoaded]);

  return null;
}
