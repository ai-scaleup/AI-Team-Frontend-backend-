"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Lock, Loader2, ArrowLeft } from "lucide-react";

import { agentForPath } from "@/lib/agentCatalog";
import { fetchAssignedAgents } from "@/lib/assignedAgents";
import { resolveUserEmail } from "@/lib/devToken";

/** The answer for one agent, so a stale result cannot decide a later page. */
type Decision = { key: string; allowed: boolean };

/**
 * Keeps an unassigned agent out of reach when its dashboard URL is typed in
 * directly. Paths that are not agents -- the grid, admin, settings -- pass
 * straight through, and so does anything the catalogue does not know about.
 */
export default function AgentAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const email = resolveUserEmail(user?.primaryEmailAddress?.emailAddress);
  const agent = agentForPath(pathname ?? "");
  const agentKey = agent?.key ?? null;
  const [decision, setDecision] = useState<Decision | null>(null);

  useEffect(() => {
    if (!agentKey || !isLoaded) return;

    const controller = new AbortController();
    let cancelled = false;

    const settle = (allowed: boolean) => {
      if (!cancelled) setDecision({ key: agentKey, allowed });
    };

    const check = async () => {
      // Without a Clerk session the development email identifies the caller.
      if (!email) {
        settle(false);
        return;
      }

      try {
        const { agentKeys } = await fetchAssignedAgents(email, controller.signal);
        settle(agentKeys.includes(agentKey));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // A lookup that cannot complete must not lock a paying user out of an
        // agent they hold, so an unreachable check fails open.
        console.error("Agent access check failed:", err);
        settle(true);
      }
    };

    check();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [agentKey, isLoaded, email]);

  if (!agent) return <>{children}</>;

  // A decision for a different agent belongs to the page we just left.
  const settled = decision?.key === agent.key ? decision : null;

  if (!settled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060B18]">
        <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
      </div>
    );
  }

  if (settled.allowed) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060B18] p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1221] p-8 text-center shadow-2xl shadow-black/50">
        <div className="relative mx-auto mb-5 h-20 w-20">
          <Image
            src={agent.image}
            alt={agent.name}
            fill
            sizes="80px"
            className="rounded-2xl object-cover opacity-40 grayscale"
          />
          <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
            <Lock size={16} />
          </span>
        </div>

        <h1 className="text-lg font-bold text-white">Agente non disponibile</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          <span className="font-medium text-white/80">{agent.name}</span> non è
          assegnato al tuo account. Contatta un amministratore per richiederne
          l&apos;accesso.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500/15 px-4 py-2.5 text-xs font-semibold text-sky-400 ring-1 ring-sky-500/30 transition hover:bg-sky-500/25"
        >
          <ArrowLeft size={14} /> Torna ai tuoi agenti
        </Link>
      </div>
    </div>
  );
}
