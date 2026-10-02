"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Scissors, Save, AlertTriangle, Check, Loader2, X
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { API_BASE } from "@/lib/apiBase";

/** What the API accepts for watermarkPercent. Shared by the slider and both boxes. */
const WATERMARK_MIN = 30;
const WATERMARK_MAX = 95;

/** What the API accepts for conversationBudget. */
const BUDGET_MIN = 1_000;
const BUDGET_MAX = 10_000_000;

/**
 * The default trigger: 80% of a 250,000-token budget, so compaction fires at
 * 200,000 tokens. The same values the server gives a new settings row.
 */
const DEFAULT_WATERMARK_PERCENT = 80;
const DEFAULT_CONVERSATION_BUDGET = 250_000;
const DEFAULT_TRIGGER_TOKENS = (DEFAULT_CONVERSATION_BUDGET * DEFAULT_WATERMARK_PERCENT) / 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Average tokens per turn, used only to draw the context preview. */
const TOKENS_PER_TURN = 420;
const PERSONA_TOKENS = 900;

type OwnerType = "GLOBAL" | "MEMBERSHIP" | "TEAM" | "AGENT";
type SummaryStyle = "STRUCTURED" | "PROSE";

interface CompactionSettings {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerLabel?: string;
  enabled: boolean;
  watermarkPercent: number;
  keepLastTurns: number;
  memoryCapTokens: number;
  conversationBudget: number;
  summaryStyle: SummaryStyle;
  apiModel: string;
}

interface CompactionStats {
  windowHours: number;
  compactions: number;
  activeChats: number;
  tokensSaved: number;
  savingPercent: number;
  costTokens: number;
}

/** One entry of the model dropdown, as /admin/compaction/api-models returns it. */
interface ApiModelOption {
  value: string;
  label: string;
  modelId: string;
  provider: string;
  isDefault: boolean;
}

/**
 * Fallback for the model dropdown, used until /admin/compaction/api-models
 * answers -- a server that predates that route never answers it, and a field
 * with no options in it looks broken rather than unavailable. The server
 * remains the authority: whatever it returns replaces this list, and it
 * validates the saved value either way.
 */
const FALLBACK_API_MODELS: ApiModelOption[] = [
  { value: "GPT_5", label: "GPT-5", modelId: "gpt-5", provider: "openai", isDefault: false },
  { value: "GPT_5_MINI", label: "GPT-5 mini", modelId: "gpt-5-mini", provider: "openai", isDefault: false },
  { value: "GPT_5_NANO", label: "GPT-5 nano", modelId: "gpt-5-nano", provider: "openai", isDefault: false },
  { value: "GPT_4_1", label: "GPT-4.1", modelId: "gpt-4.1", provider: "openai", isDefault: false },
  { value: "GPT_4_1_MINI", label: "GPT-4.1 mini", modelId: "gpt-4.1-mini", provider: "openai", isDefault: false },
  { value: "GPT_4O", label: "GPT-4o", modelId: "gpt-4o", provider: "openai", isDefault: false },
  { value: "GPT_4O_MINI", label: "GPT-4o mini", modelId: "gpt-4o-mini", provider: "openai", isDefault: true },
  { value: "O3", label: "o3", modelId: "o3", provider: "openai", isDefault: false },
  { value: "O4_MINI", label: "o4-mini", modelId: "o4-mini", provider: "openai", isDefault: false },
];

function Toggle({
  on,
  onClick,
  tone = "sky",
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  tone?: "sky" | "emerald";
  disabled?: boolean;
}) {
  const active = tone === "emerald" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? active : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

/**
 * A select whose value matches no option renders the first one instead, which
 * would misreport what is stored. Called for the current value so it always
 * has an option of its own — whether the catalog has not loaded yet or no
 * longer lists that model.
 */
function unlistedModelOption(current: string, models: ApiModelOption[]) {
  if (!current || models.some((model) => model.value === current)) return null;
  return <option value={current}>{current}</option>;
}

export default function CompactionPage() {
  const [settings, setSettings] = useState<CompactionSettings | null>(null);
  const [apiModels, setApiModels] = useState<ApiModelOption[]>(FALLBACK_API_MODELS);
  const [stats, setStats] = useState<CompactionStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which trigger box is being typed in, and what it currently holds. The
  // other box keeps following the stored value, so the two never fight over
  // a number that is still being entered.
  const [triggerEdit, setTriggerEdit] = useState<"percent" | "tokens" | null>(null);
  const [triggerDraft, setTriggerDraft] = useState("");

  const readError = async (response: Response, fallback: string) => {
    try {
      const body = await response.json();
      return (body?.message as string) || fallback;
    } catch {
      return fallback;
    }
  };

  const loadAll = useCallback(async () => {
    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is not configured.");
      setLoading(false);
      return;
    }

    try {
      const [settingsRes, modelsRes, statsRes] = await Promise.all([
        authenticatedFetch(`${API_BASE}/admin/compaction/settings`),
        authenticatedFetch(`${API_BASE}/admin/compaction/api-models`),
        authenticatedFetch(`${API_BASE}/admin/compaction/stats`),
      ]);

      if (!settingsRes.ok) throw new Error(await readError(settingsRes, "Could not load settings"));

      const loadedSettings: CompactionSettings = await settingsRes.json();
      setSettings(loadedSettings);
      if (modelsRes.ok) {
        const loadedModels: ApiModelOption[] = await modelsRes.json();
        if (loadedModels.length > 0) setApiModels(loadedModels);
      }
      if (statsRes.ok) setStats(await statsRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Edits stay local until Save, so a slider drag is not 40 requests. */
  const patchLocal = (updates: Partial<CompactionSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...updates } : prev));

  const handleSave = async () => {
    if (!settings || !API_BASE) return;
    setSaving(true);
    setError(null);

    try {
      const settingsRes = await authenticatedFetch(`${API_BASE}/admin/compaction/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          watermarkPercent: settings.watermarkPercent,
          keepLastTurns: settings.keepLastTurns,
          memoryCapTokens: settings.memoryCapTokens,
          conversationBudget: settings.conversationBudget,
          summaryStyle: settings.summaryStyle,
          apiModel: settings.apiModel,
        }),
      });
      if (!settingsRes.ok) throw new Error(await readError(settingsRes, "Could not save settings"));
      const fresh: CompactionSettings = await settingsRes.json();
      setSettings(fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // Context preview, driven by the settings above.
  const recentTokens = (settings?.keepLastTurns ?? 0) * TOKENS_PER_TURN;
  const memoryCap = settings?.memoryCapTokens ?? 0;
  const budget = settings?.conversationBudget ?? 0;
  const usedTokens = PERSONA_TOKENS + memoryCap + recentTokens;
  const freeTokens = Math.max(budget - usedTokens, 0);
  const pct = (n: number) => (budget > 0 ? Math.min((n / budget) * 100, 100) : 0);

  // Rounded down, as the server does when it checks the watermark.
  const triggerAt = useMemo(
    () => Math.floor((budget * (settings?.watermarkPercent ?? 0)) / 100),
    [budget, settings?.watermarkPercent],
  );

  /**
   * The trigger is stored as a percentage of the budget, so a token figure is
   * that percentage of the budget. An out-of-range percentage is clamped
   * rather than rejected, so a typed 99 lands on the highest the API accepts
   * instead of throwing the form away.
   */
  const commitPercent = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
      patchLocal({
        watermarkPercent: Math.round(clamp(parsed, WATERMARK_MIN, WATERMARK_MAX)),
      });
    }
    setTriggerEdit(null);
  };

  /**
   * A token figure the budget can express moves the percentage. One it cannot
   * -- 200,000 against a 70,000 budget -- keeps the percentage and moves the
   * budget instead, so the trigger lands on the number that was typed rather
   * than snapping back to the edge of the old budget.
   */
  const commitTokens = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0 && budget > 0 && settings) {
      const percent = (parsed / budget) * 100;
      if (percent >= WATERMARK_MIN && percent <= WATERMARK_MAX) {
        patchLocal({ watermarkPercent: Math.round(percent) });
      } else {
        patchLocal({
          conversationBudget: clamp(
            Math.ceil((parsed * 100) / settings.watermarkPercent),
            BUDGET_MIN,
            BUDGET_MAX,
          ),
        });
      }
    }
    setTriggerEdit(null);
  };

  const beginTriggerEdit = (field: "percent" | "tokens", value: number) => {
    setTriggerEdit(field);
    setTriggerDraft(String(value));
  };

  const selectedModel = useMemo(
    () => apiModels.find((model) => model.value === settings?.apiModel) ?? null,
    [apiModels, settings?.apiModel],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-white/40">
        <Loader2 size={20} className="mr-2 animate-spin" /> Loading compaction settings…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-6 text-sm text-rose-200">
          {error ?? "Compaction settings are unavailable."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold">Conversation Compaction</h1>
          <p className="text-sm text-white/50">
            Summarise older turns so a chat stays coherent as it fills up, without changing what the user sees.
          </p>
        </div>
        {stats && (
          <div className="flex flex-shrink-0 gap-6 rounded-2xl border border-white/10 bg-[#0F172A] px-6 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Last 24h</p>
              <p className="font-mono text-lg text-white">{stats.compactions}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Tokens saved</p>
              <p className="font-mono text-lg text-emerald-300">{stats.tokensSaved.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Active chats</p>
              <p className="font-mono text-lg text-white">{stats.activeChats}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] p-4">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-rose-400" />
          <p className="flex-1 text-sm text-rose-200">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-300/60 hover:text-rose-200">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-8 lg:col-span-2">

          {/* Global defaults */}
          <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Scissors size={20} className="text-sky-400" /> Global defaults
              </h2>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${settings.enabled ? "text-emerald-300" : "text-white/40"}`}>
                  {settings.enabled ? "Auto-compaction on" : "Auto-compaction off"}
                </span>
                <Toggle
                  on={settings.enabled}
                  onClick={() => patchLocal({ enabled: !settings.enabled })}
                  tone="emerald"
                />
              </div>
            </div>
            <p className="mb-6 text-xs text-white/40">
              Applied to every conversation on the platform.
            </p>

            {/* Watermark ruler */}
            <div
              className={`mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 transition ${
                settings.enabled ? "" : "opacity-40"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="text-[10px] uppercase tracking-wider text-white/40">
                  Compact when the conversation reaches
                </label>

                <div className="flex items-center gap-1.5 font-mono text-sm text-sky-300">
                  <input
                    type="number"
                    min={WATERMARK_MIN}
                    max={WATERMARK_MAX}
                    aria-label="Compact at this percentage of the budget"
                    value={triggerEdit === "percent" ? triggerDraft : settings.watermarkPercent}
                    disabled={!settings.enabled}
                    onFocus={() => beginTriggerEdit("percent", settings.watermarkPercent)}
                    onChange={(e) => setTriggerDraft(e.target.value)}
                    onBlur={(e) => commitPercent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-sky-300 outline-none transition focus:border-sky-500"
                  />
                  <span className="text-white/30">%</span>
                  <span className="px-1 text-white/20">·</span>
                  <span className="text-white/30">~</span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    aria-label="Compact at this many tokens"
                    // Without a budget the watermark has no token figure to
                    // show: the server measures it against the platform limit,
                    // which this panel does not know.
                    disabled={!settings.enabled || budget <= 0}
                    title={budget > 0 ? undefined : "Set a conversation budget to enter this as tokens"}
                    value={triggerEdit === "tokens" ? triggerDraft : triggerAt}
                    onFocus={() => beginTriggerEdit("tokens", triggerAt)}
                    onChange={(e) => setTriggerDraft(e.target.value)}
                    onBlur={(e) => commitTokens(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-sky-300 outline-none transition focus:border-sky-500 disabled:opacity-40"
                  />
                  <span className="text-white/30">tokens</span>
                </div>
              </div>

              <div className="relative h-3 w-full rounded-full bg-white/[0.06]">
                <div
                  className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-sky-500/40 to-sky-400/70"
                  style={{ width: `${settings.watermarkPercent}%` }}
                />
                <div
                  className="absolute -top-1 h-5 w-0.5 bg-sky-300"
                  style={{ left: `${settings.watermarkPercent}%` }}
                />
                <div className="absolute -top-1 right-0 h-5 w-0.5 bg-rose-400" />
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-white/30">
                <span>0</span>
                <span className="text-sky-300/80">compaction fires</span>
                <span className="text-rose-300/80">100% hard stop</span>
              </div>

              <input
                type="range"
                min={WATERMARK_MIN}
                max={WATERMARK_MAX}
                step={1}
                value={settings.watermarkPercent}
                disabled={!settings.enabled}
                onChange={(e) => patchLocal({ watermarkPercent: Number(e.target.value) })}
                className="mt-4 w-full accent-sky-500"
              />

              {(settings.watermarkPercent !== DEFAULT_WATERMARK_PERCENT ||
                settings.conversationBudget !== DEFAULT_CONVERSATION_BUDGET) && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={!settings.enabled}
                    onClick={() =>
                      patchLocal({
                        watermarkPercent: DEFAULT_WATERMARK_PERCENT,
                        conversationBudget: DEFAULT_CONVERSATION_BUDGET,
                      })
                    }
                    className="text-[11px] text-sky-300/80 underline-offset-2 transition hover:text-sky-200 hover:underline disabled:pointer-events-none"
                  >
                    Reset to default · {DEFAULT_TRIGGER_TOKENS.toLocaleString()} tokens
                  </button>
                </div>
              )}
            </div>

            {/* Numeric fields */}
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${
                settings.enabled ? "" : "opacity-40"
              }`}
            >
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/40">
                  Keep last turns
                </label>
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={settings.keepLastTurns}
                  disabled={!settings.enabled}
                  onChange={(e) => patchLocal({ keepLastTurns: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
                />
                <p className="mt-1 text-[10px] text-white/25">Sent to the model verbatim</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/40">
                  Summary cap
                </label>
                <input
                  type="number"
                  step={100}
                  min={200}
                  max={20000}
                  value={settings.memoryCapTokens}
                  disabled={!settings.enabled}
                  onChange={(e) => patchLocal({ memoryCapTokens: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
                />
                <p className="mt-1 text-[10px] text-white/25">Max size of the summary</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/40">
                  Conversation budget
                </label>
                <input
                  type="number"
                  step={1000}
                  min={0}
                  value={settings.conversationBudget}
                  disabled={!settings.enabled}
                  onChange={(e) => patchLocal({ conversationBudget: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
                />
                <p className="mt-1 text-[10px] text-white/25">0 follows the platform limit</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/40">
                  Summary style
                </label>
                <select
                  value={settings.summaryStyle}
                  disabled={!settings.enabled}
                  onChange={(e) => patchLocal({ summaryStyle: e.target.value as SummaryStyle })}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
                >
                  <option value="STRUCTURED">Structured</option>
                  <option value="PROSE">Prose</option>
                </select>
                <p className="mt-1 text-[10px] text-white/25">Structured survives re-summarising</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/40">
                  Summary model
                </label>
                <select
                  value={settings.apiModel}
                  disabled={!settings.enabled}
                  onChange={(e) => patchLocal({ apiModel: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
                  title="The model that writes the summary, not the reply — each agent keeps its own model."
                >
                  {unlistedModelOption(settings.apiModel, apiModels)}
                  {apiModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-white/25">
                  {selectedModel
                    ? `Writes the summary · ${selectedModel.modelId}`
                    : "Writes the summary, not the reply"}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">

            {/* Context preview */}
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
              <h3 className="mb-1 text-sm font-semibold">Context after a compaction</h3>
              <p className="mb-5 text-xs text-white/40">
                What the model receives on the next turn, with the settings on the left.
              </p>

              <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className="bg-indigo-500/70" style={{ width: `${pct(PERSONA_TOKENS)}%` }} />
                <div className="bg-sky-500/70" style={{ width: `${pct(memoryCap)}%` }} />
                <div className="bg-emerald-500/70" style={{ width: `${pct(recentTokens)}%` }} />
              </div>

              <div className="space-y-2.5">
                {[
                  { c: "bg-indigo-500/70", label: "Agent persona", v: PERSONA_TOKENS },
                  { c: "bg-sky-500/70", label: "Summary", v: memoryCap },
                  { c: "bg-emerald-500/70", label: `Last ${settings.keepLastTurns} turns`, v: recentTokens },
                  { c: "bg-white/15", label: "Room to keep talking", v: freeTokens },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-white/60">
                      <span className={`h-2 w-2 rounded-full ${row.c}`} />
                      {row.label}
                    </span>
                    <span className="font-mono text-white/80">{row.v.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Conversation budget</span>
                  <span className="font-mono text-white">
                    {budget > 0 ? budget.toLocaleString() : "platform limit"}
                  </span>
                </div>
                {budget > 0 && usedTokens > budget && (
                  <p className="mt-3 flex items-start gap-2 text-[11px] text-rose-300">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    The compacted context alone exceeds the budget. Lower the summary cap or keep fewer turns.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                saved ? "bg-emerald-600" : "bg-sky-600 hover:bg-sky-500"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : saved ? (
                <>
                  <Check size={16} /> Saved
                </>
              ) : (
                <>
                  <Save size={16} /> Save compaction settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
