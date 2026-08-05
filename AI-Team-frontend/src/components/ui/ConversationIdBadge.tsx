"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

// Shows the ID of the conversation currently open, so it can be read straight
// off the chat header and used against the conversation endpoints -- token
// counters, message history -- instead of being dug out of the network tab.
//
// Lives in one component rather than being pasted into each agent page: the
// agent pages are near-identical copies, and this keeps a single place to
// change the styling or drop the badge behind a role check later.
export default function ConversationIdBadge({
  conversationId,
  className = "",
}: {
  conversationId: string | null | undefined;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Switching chats clears the confirmation: a tick left over from the previous
  // conversation reads as "this new id was copied", which it was not.
  useEffect(() => {
    setCopied(false);
  }, [conversationId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  // Nothing is open yet on a fresh page load, and an empty placeholder in the
  // header is just noise.
  if (!conversationId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(conversationId);
      setCopied(true);
    } catch {
      // Clipboard access needs a secure context and can be refused. The id is
      // still on screen and selectable, so there is nothing useful to report.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`${conversationId} — clicca per copiare`}
      aria-label={`Copia l'ID conversazione ${conversationId}`}
      className={`group inline-flex max-w-[160px] sm:max-w-none items-center gap-1 sm:gap-1.5 rounded px-1.5 sm:px-2 py-0.5 border border-slate-400/40 dark:border-white/15 bg-slate-200/60 dark:bg-white/5 hover:bg-slate-300/70 dark:hover:bg-white/10 transition-colors cursor-pointer ${className}`}
    >
      <span className="font-mono text-[8px] sm:text-[10px] font-semibold tracking-tight text-slate-600 dark:text-slate-300 truncate">
        {conversationId}
      </span>
      {copied ? (
        <Check size={10} className="shrink-0 text-emerald-500" />
      ) : (
        <Copy
          size={10}
          className="shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
        />
      )}
    </button>
  );
}
