"use client";

import { Coins } from "lucide-react";
import { useConversationTokenGate } from "@/hooks/useConversationTokenGate";

// Shows the token budget of the conversation currently open -- how much of the
// limit has been spent and how much is left -- next to the conversation id in
// the chat header.
//
// The counters live on the conversation row and are written by the n8n
// workflow after each run, so this component only ever reads them.
//
// Lives next to ConversationIdBadge rather than inside it: that one is a copy
// button for the id, this one is a read-only gauge, and a page may want either
// on its own.

const formatTokens = (value: number) => new Intl.NumberFormat("it-IT").format(value);

export default function ConversationTokensBadge({
  conversationId,
  refreshKey = 0,
  className = "",
}: {
  conversationId: string | null | undefined;
  // Bump this when a reply completes to re-read the counters.
  refreshKey?: number;
  className?: string;
}) {
  // Same read the composer's token gate uses, so the header and the announcer
  // bar can never disagree about how much budget is left.
  const { limit, used, left, isLoaded } = useConversationTokenGate(conversationId, refreshKey);

  // Nothing is open yet, or the first read has not landed -- an empty gauge in
  // the header is just noise.
  if (!conversationId || !isLoaded) return null;

  const spentRatio = limit && limit > 0 ? Math.min(used / limit, 1) : 0;

  // Turns the gauge amber then red as the budget runs down, so a conversation
  // about to run out is visible without reading the numbers.
  const barColor =
    spentRatio >= 0.9 ? "bg-rose-500" : spentRatio >= 0.75 ? "bg-amber-500" : "bg-sky-500";

  const title =
    limit != null
      ? `Token: ${formatTokens(used)} usati · ${formatTokens(left ?? 0)} rimasti · limite ${formatTokens(limit)}`
      : `Token: ${formatTokens(used)} usati · nessun limite assegnato`;

  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1 sm:gap-1.5 rounded px-1.5 sm:px-2 py-0.5 border border-slate-400/40 dark:border-white/15 bg-slate-200/60 dark:bg-white/5 ${className}`}
    >
      <Coins size={10} className="shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="font-mono text-[8px] sm:text-[10px] font-semibold tracking-tight text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {limit != null ? `${formatTokens(used)} / ${formatTokens(limit)}` : formatTokens(used)}
      </span>
      {limit != null && (
        <span className="hidden sm:block h-1 w-12 rounded-full overflow-hidden bg-slate-400/40 dark:bg-white/10">
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ${barColor}`}
            style={{ width: `${spentRatio * 100}%` }}
          />
        </span>
      )}
    </div>
  );
}
