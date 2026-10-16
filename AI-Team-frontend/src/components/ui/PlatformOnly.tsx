"use client";

import type { ReactNode } from "react";
import { useIsAgencyAddress } from "@/lib/session";

/** Renders its children on the AI Team platform only, never on an agency's own address. */
export default function PlatformOnly({ children }: { children: ReactNode }) {
  return useIsAgencyAddress() ? null : <>{children}</>;
}
