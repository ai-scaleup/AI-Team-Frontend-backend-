"use client";

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { FormEvent, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Coins,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const AGENT_OPTIONS = [
  "JIM",
  "ALEX",
  "MIKE",
  "TONY",
  "LARA",
  "VALENTINA",
  "DANIELE",
  "SIMONE",
  "NIKO",
  "ALADINO",
  "LAURA",
  "DAN",
  "MAX",
  "SOFIA",
  "ROBERTA",
  "SARA_AI",
  "JENNIFER_AI",
  "CHIARA_AI",
  "PEARL_ADMIN",
  "TEST_JIM",
  "TEST_ALEX",
  "TEST_MIKE",
  "TEST_TONY",
  "TEST_LARA",
  "TEST_VALENTINA",
  "TEST_DANIELE",
  "TEST_SIMONE",
  "TEST_NIKO",
  "TEST_ALADINO",
  "TEST_LAURA",
  "TEST_DAN",
  "TEST_MAX",
  "TEST_SOFIA",
  "TEST_ROBERTA",
  "TEST_SARA_AI",
  "TEST_JENNIFER_AI",
  "TEST_CHIARA_AI",
];

type TokenLimitRecord = {
  agentName: string;
  totalTokenLimit?: number;
  totalTokensLeft?: number;
};

const formatTokens = (value?: number) =>
  new Intl.NumberFormat("en-US").format(Number(value ?? 0));

async function parseApiError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join(", ");
  } catch {
    // Use status text below.
  }

  return response.statusText || "Request failed";
}

export default function AssignTokensPage() {
  const [email, setEmail] = useState("");
  const [agentName, setAgentName] = useState(AGENT_OPTIONS[0]);
  const [totalTokenLimit, setTotalTokenLimit] = useState("100000");
  const [savedRecord, setSavedRecord] = useState<TokenLimitRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const assignTokenLimit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    const tokenLimit = Number(totalTokenLimit);

    if (!normalizedEmail) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }

    if (!Number.isInteger(tokenLimit) || tokenLimit < 0) {
      setMessage({
        type: "error",
        text: "Total token limit must be a non-negative integer.",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/token-usage/${encodeURIComponent(normalizedEmail)}/${encodeURIComponent(agentName)}/limit`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalTokenLimit: tokenLimit }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const record = (await response.json()) as TokenLimitRecord;
      setSavedRecord(record);
      setMessage({
        type: "success",
        text: `Token limit updated for ${normalizedEmail} on ${agentName}.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to update token limit.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Assign Tokens</h1>
        <p className="text-sm text-white/50">
          Set a token limit for a user and agent.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
        <div className="mb-6 flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck size={20} className="text-emerald-400" />
            Token Limit
          </h2>
        </div>

        <form onSubmit={assignTokenLimit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs text-white/50">
              User Email
            </label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-white/50">
              Agent Name
            </label>
            <div className="relative">
              <Bot
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <select
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none transition focus:border-emerald-500"
              >
                {AGENT_OPTIONS.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-white/50">
              Total Token Limit
            </label>
            <div className="relative">
              <Coins
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={totalTokenLimit}
                onChange={(event) => setTotalTokenLimit(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 font-mono text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Set Token Limit
          </button>
        </form>

        {message && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/20 bg-red-500/10 text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {savedRecord && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                Total Token Limit
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">
                {formatTokens(savedRecord.totalTokenLimit)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                Tokens Left
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">
                {formatTokens(savedRecord.totalTokensLeft)}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
