"use client";

import { API_BASE } from "@/lib/apiBase"
import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, User as UserIcon, Calendar, Activity, CreditCard,
  Bot, ChevronDown, OctagonAlert, Shield, Mail, Hash,
  DollarSign, Euro, X, Loader2, AlertTriangle, Users, RefreshCw, Pencil, Check
} from "lucide-react";
import {
  Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart
} from "recharts";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const SONNET_4_6_INPUT_USD_PER_TOKEN = 3 / 1000000;
const SONNET_4_6_OUTPUT_USD_PER_TOKEN = 15 / 1000000;
const EUR_RATE = 0.92;

type CurrencyMode = "tokens" | "USD" | "EUR";

const getClaudeSonnet46Usd = (
  inputTokens = 0,
  outputTokens = 0,
): number => {
  return (
    inputTokens * SONNET_4_6_INPUT_USD_PER_TOKEN +
    outputTokens * SONNET_4_6_OUTPUT_USD_PER_TOKEN
  );
};

const formatAxisValue = (value: number, currency: CurrencyMode): string => {
  if (currency === "tokens") return `${(value / 1000).toFixed(0)}k`;
  if (currency === "EUR") return `€${value >= 1 ? value.toFixed(1) : value.toFixed(2)}`;
  return `$${value >= 1 ? value.toFixed(1) : value.toFixed(2)}`;
};

const formatChartValue = (value: number, currency: CurrencyMode): string => {
  if (currency === "tokens") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    return `${(value / 1000).toFixed(1)}k`;
  }
  if (currency === "EUR") return value >= 1000 ? `€${(value / 1000).toFixed(1)}k` : `€${value.toFixed(value >= 1 ? 2 : 3)}`;
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(value >= 1 ? 2 : 3)}`;
};

const EXCLUDED_TOOLTIP_KEYS = new Set(["stops", "total"]);

const SortedTooltip = ({
  active, payload, label, currency,
}: {
  active?: boolean;
  // Loose on purpose: Recharts passes entries whose name/value may be undefined.
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; stroke?: string }>;
  label?: string | number;
  currency: CurrencyMode;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = payload
    .map((entry) => ({ ...entry, name: String(entry.name ?? ""), value: Number(entry.value) }))
    .filter((entry) => !EXCLUDED_TOOLTIP_KEYS.has(entry.name) && Number(entry.value) > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return null;
  return (
    <div style={{ backgroundColor: "#0f172a", border: "1px solid #ffffff15", borderRadius: "10px", padding: "10px 14px", fontSize: "12px" }}>
      <p style={{ color: "#ffffff80", marginBottom: 6 }}>{label}</p>
      {sorted.map((entry) => {
        const color = entry.stroke ?? entry.color;
        return (
          <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", gap: 20, color: "#fff", marginBottom: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
              {entry.name}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatChartValue(Number(entry.value), currency)}</span>
          </div>
        );
      })}
    </div>
  );
};

function CurrencyToggle({
  currency,
  onChange,
  size = "default",
}: {
  currency: CurrencyMode;
  onChange: (c: CurrencyMode) => void;
  size?: "default" | "small";
}) {
  const modes: { key: CurrencyMode; label: string; icon: React.ReactNode }[] = [
    { key: "tokens", label: "Tokens", icon: <Activity size={size === "small" ? 10 : 12} /> },
    { key: "USD", label: "$ USD", icon: <DollarSign size={size === "small" ? 10 : 12} /> },
    { key: "EUR", label: "€ EUR", icon: <Euro size={size === "small" ? 10 : 12} /> },
  ];
  return (
    <div className={`flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5 ${size === "small" ? "gap-0" : "gap-0.5"}`}>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`flex items-center gap-1 rounded-md transition-all font-medium ${
            size === "small" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
          } ${
            currency === m.key
              ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30 shadow-sm"
              : "text-white/40 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────── MOCK DATA ─────────────────── */

type ApiAssignment = {
  id?: string;
  agentName?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  durationDays?: number | null;
  monthlyTokenLimit?: number | null;
  tokenLimit?: number | null;
  // Per-grant rollup kept on the assignment row itself (see
  // SingleAssignedAgent / AssignedTeam in the schema).
  usedTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  tokensLeft?: number | null;
  isActive?: boolean;
};

type ApiGroupAssignment = Omit<ApiAssignment, "agentName"> & {
  group?: {
    name?: string | null;
    items?: { agentName?: string }[];
  } | null;
};

// Per-agent slice of a team grant (AssignedTeamAgent): the team's tokenLimit
// is what EACH agent gets, and every agent tracks its own spend.
type ApiTeamAgentGrant = {
  id?: string;
  agentName?: string;
  tokenLimit?: number | null;
  usedTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  tokensLeft?: number | null;
};

type ApiTeamAssignment = Omit<ApiAssignment, "agentName"> & {
  teamId?: string;
  /** Per-agent allowance (not a shared pool). */
  tokenLimit?: number | null;
  agents?: ApiTeamAgentGrant[] | null;
  team?: {
    id?: string;
    name?: string | null;
    agents?: { agentName?: string }[];
  } | null;
};

// A membership grant carries ONE pool shared by every agent it reaches
// (AssignedMembership): whichever agent chats, the same counters move.
type ApiMembershipAssignment = {
  id?: string;
  monthlyTokenLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  /** Start of the 30-day cycle the pool counters belong to. */
  cycleStartsAt?: string | null;
  /** Combined spend of all the membership's agents this cycle. */
  usedTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  tokensLeft?: number | null;
  template?: {
    name?: string | null;
    durationDays?: number | null;
    monthlyTokenLimit?: number | null;
    includedAgents?: string[] | null;
    includedTeams?: {
      team?: {
        id?: string;
        name?: string | null;
        agents?: { agentName?: string }[] | null;
        isActive?: boolean;
      } | null;
    }[] | null;
  } | null;
};

type ApiTokenUsage = {
  agentName?: string;
  totalTokenLimit?: number | null;
  totalTokensLeft?: number | null;
  totalUsedInputTokens?: number | null;
  totalUsedOutputTokens?: number | null;
  totalUsedTokens?: number | null;
};

// The balance the server enforces: allowance minus what the agent spent inside
// its current 30-day cycle. The tokenUsage counters are lifetime totals and
// cannot answer this on their own.
type ApiAgentQuota = {
  agentName?: string;
  limit?: number | null;
  /** The agent's own allowance (direct grant + team slices). */
  agentLimit?: number | null;
  /** Membership pool shared with the membership's other agents. */
  poolLimit?: number | null;
  poolUsed?: number | null;
  poolLeft?: number | null;
  cycleStart?: string | null;
  cycleUsedTokens?: number | null;
  tokensLeft?: number | null;
};

type ApiDailyUsage = {
  agentName?: string;
  date?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

type ApiUserDetails = {
  user: {
    email: string;
    oauthId: string;
    username?: string | null;
    createdAt?: string | null;
    agents?: ApiAssignment[];
    groups?: ApiGroupAssignment[];
    teams?: ApiTeamAssignment[];
    memberships?: ApiMembershipAssignment[];
    tokenUsage?: ApiTokenUsage[];
    stopLogs?: unknown[];
  };
  dailyUsage?: ApiDailyUsage[];
  // Team and single-agent spend by day. Charts only: those tiers stay out of
  // dailyUsage, which the agent tables read as quota usage.
  grantDailyUsage?: ApiDailyUsage[];
  agentQuotas?: ApiAgentQuota[];
};

// Everything spent in the range, whatever tier billed it -- what the charts plot.
const collectChartUsageRows = (details: ApiUserDetails | null): ApiDailyUsage[] => [
  ...(details?.dailyUsage ?? []),
  ...(details?.grantDailyUsage ?? []),
];

type PendingRemoval = {
  kind: "membership" | "team" | "agent";
  id: string;
  name: string;
};

const REMOVAL_COPY: Record<PendingRemoval["kind"], { title: string; note: string; action: string }> = {
  membership: {
    title: "Remove membership",
    note: "Its agents and teams stop being reachable through this plan. Usage records are kept, and the membership can be assigned again later.",
    action: "Remove membership",
  },
  team: {
    title: "Remove team access",
    note: "Its agents stop being reachable through this team. Usage records are kept, and the team can be assigned again later.",
    action: "Remove team",
  },
  agent: {
    title: "Remove agent access",
    note: "Past usage and token records are kept, and the agent can be assigned again later.",
    action: "Remove agent",
  },
};

type RemoveButtonProps = {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
};

const RemoveButton = ({ label, busy, disabled, onClick, className = "" }: RemoveButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={`shrink-0 rounded p-1 transition hover:bg-red-500/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
  >
    {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
  </button>
);

const formatDate = (value?: string | null) => {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toISOString().slice(0, 10);
};

const isActiveAssignment = (item?: { isActive?: boolean; expiresAt?: string | null }) => {
  if (!item || item.isActive === false) return false;
  if (!item.expiresAt) return true;
  const expiry = new Date(item.expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry > new Date();
};

const collectAssignedAgentNames = (details: ApiUserDetails | null): string[] => {
  const activeMemberships = (details?.user.memberships ?? []).filter(isActiveAssignment);
  const activeGroups = (details?.user.groups ?? []).filter(isActiveAssignment);
  const activeTeams = (details?.user.teams ?? []).filter(isActiveAssignment);
  const activeAgents = (details?.user.agents ?? []).filter(isActiveAssignment);
  const assignedAgents = new Set<string>();

  activeAgents.forEach((agent) => agent.agentName && assignedAgents.add(agent.agentName));
  activeTeams.forEach((assignment) => {
    assignment.team?.agents?.forEach((item) => item.agentName && assignedAgents.add(item.agentName));
  });
  activeGroups.forEach((assignment) => {
    assignment.group?.items?.forEach((item) => item.agentName && assignedAgents.add(item.agentName));
  });
  activeMemberships.forEach((assignment) => {
    assignment.template?.includedAgents?.forEach((agentName) => assignedAgents.add(agentName));
    // Agents reached through the membership's active agent teams.
    assignment.template?.includedTeams?.forEach((link) => {
      if (link.team?.isActive === false) return;
      link.team?.agents?.forEach((item) => item.agentName && assignedAgents.add(item.agentName));
    });
  });

  return Array.from(assignedAgents);
};

// Only a direct AssignedAgent record can be removed one agent at a time. Agents
// inherited from a group or a membership template go away with that assignment.
const collectDirectAgentNames = (details: ApiUserDetails | null): string[] =>
  (details?.user.agents ?? [])
    .filter(isActiveAssignment)
    .map((agent) => agent.agentName)
    .filter((name): name is string => Boolean(name));


// A series must be colored by agent name, not its position in an API response.
const AGENT_USAGE_COLORS: Record<string, string> = {
  SARA_AI: "#06b6d4", JENNIFER_AI: "#e879f9", CHIARA_AI: "#f472b6",
  JIM: "#f59e0b", ALEX: "#f87171", MIKE: "#8b5cf6", TONY: "#fb7185",
  LARA: "#fbbf24", VALENTINA: "#ec4899", DANIELE: "#4ade80",
  SIMONE: "#2dd4bf", NIKO: "#fb923c", ALADINO: "#38bdf8", LAURA: "#c084fc",
  DAN: "#84cc16", MAX: "#14b8a6", SOFIA: "#fde047", ROBERTA: "#a855f7",
  TEST_SARA_AI: "#0ea5e9", TEST_JENNIFER_AI: "#d946ef", TEST_CHIARA_AI: "#db2777",
  TEST_JIM: "#d97706", TEST_ALEX: "#ef4444", TEST_MIKE: "#7c3aed", TEST_TONY: "#e11d48",
  TEST_LARA: "#eab308", TEST_VALENTINA: "#be185d", TEST_DANIELE: "#22c55e",
  TEST_SIMONE: "#0d9488", TEST_NIKO: "#ea580c", TEST_ALADINO: "#2563eb", TEST_LAURA: "#9333ea",
  TEST_DAN: "#65a30d", TEST_MAX: "#0f766e", TEST_SOFIA: "#ca8a04", TEST_ROBERTA: "#7e22ce",
};

const getAgentUsageColor = (agentName: string) =>
  AGENT_USAGE_COLORS[agentName.trim().toUpperCase()] ?? "#94a3b8";

type AgentTokenUsageRow = {
  name: string;
  limit: number;
  used: number;
  left: number;
  cycleUsed: number;
  input: number;
  output: number;
  color: string;
};

type DailyUsagePoint = {
  date: string;
  total: number;
  stops: number;
  [agentName: string]: string | number;
};

const inputKey = (agentName: string) => `${agentName}__input`;
const outputKey = (agentName: string) => `${agentName}__output`;

type AgentUsageSeries = {
  name: string;
  color: string;
};

type StopDotProps = {
  cx?: number;
  cy?: number;
  payload?: {
    date?: string;
    week?: string;
    stops?: number;
  };
};

const buildAgentTokenUsage = (details: ApiUserDetails | null): AgentTokenUsageRow[] => {
  const rows = details?.user.tokenUsage ?? [];
  const assignedAgents = collectAssignedAgentNames(details);
  const seenAgents = new Set<string>();
  const dailyUsageRows = details?.dailyUsage;
  const hasDailyUsagePayload = Array.isArray(dailyUsageRows);
  const dailyUsedByAgent = new Map<string, number>();
  const dailyInputByAgent = new Map<string, number>();
  const dailyOutputByAgent = new Map<string, number>();

  if (hasDailyUsagePayload) {
    dailyUsageRows.forEach((item) => {
      if (!item.agentName) return;
      dailyUsedByAgent.set(
        item.agentName,
        (dailyUsedByAgent.get(item.agentName) ?? 0) + (item.totalTokens ?? 0),
      );
      dailyInputByAgent.set(
        item.agentName,
        (dailyInputByAgent.get(item.agentName) ?? 0) + (item.inputTokens ?? 0),
      );
      dailyOutputByAgent.set(
        item.agentName,
        (dailyOutputByAgent.get(item.agentName) ?? 0) + (item.outputTokens ?? 0),
      );
    });
  }

  const quotaByAgent = new Map<string, ApiAgentQuota>();
  (details?.agentQuotas ?? []).forEach((quota) => {
    if (quota.agentName) quotaByAgent.set(quota.agentName, quota);
  });

  const tokenRows = rows
    .map((item) => {
      const name = item.agentName ?? "UNKNOWN_AGENT";
      const quota = quotaByAgent.get(name);
      const cumulativeUsed = item.totalUsedTokens ?? 0;
      // The allowance the server actually enforces, which comes from the live
      // assignment; the stored totalTokenLimit is only its legacy fallback.
      const limit = quota?.limit ?? item.totalTokenLimit ?? 0;
      const cycleUsed = quota?.cycleUsedTokens ?? cumulativeUsed;
      const used = hasDailyUsagePayload ? dailyUsedByAgent.get(name) ?? 0 : cumulativeUsed;
      const left = quota?.tokensLeft ?? Math.max(0, limit - cycleUsed);
      seenAgents.add(name);

      return {
        name,
        limit,
        used,
        left,
        cycleUsed,
        input: hasDailyUsagePayload ? dailyInputByAgent.get(name) ?? 0 : item.totalUsedInputTokens ?? 0,
        output: hasDailyUsagePayload ? dailyOutputByAgent.get(name) ?? 0 : item.totalUsedOutputTokens ?? 0,
        color: getAgentUsageColor(name),
      };
    })
    .filter((item) => item.name !== "UNKNOWN_AGENT" || item.limit > 0 || item.used > 0);

  assignedAgents.forEach((name) => {
    if (!seenAgents.has(name)) {
      const quota = quotaByAgent.get(name);
      tokenRows.push({
        name,
        limit: quota?.limit ?? 0,
        used: 0,
        left: quota?.tokensLeft ?? 0,
        cycleUsed: quota?.cycleUsedTokens ?? 0,
        input: 0,
        output: 0,
        color: getAgentUsageColor(name),
      });
    }
  });

  dailyUsedByAgent.forEach((used, name) => {
    if (!seenAgents.has(name)) {
      const quota = quotaByAgent.get(name);
      tokenRows.push({
        name,
        limit: quota?.limit ?? 0,
        used,
        left: quota?.tokensLeft ?? 0,
        cycleUsed: quota?.cycleUsedTokens ?? 0,
        input: dailyInputByAgent.get(name) ?? 0,
        output: dailyOutputByAgent.get(name) ?? 0,
        color: getAgentUsageColor(name),
      });
    }
  });

  return tokenRows.sort((a, b) => b.used - a.used);
};

/* ─────────── TOKEN USAGE SPLIT BY TIER (single / team / membership) ─────────── */

// Usage the agent produced in the selected range, regardless of which tier
// granted it. The allowance itself lives on the tier, so it is not in here.
type AgentRangeUsage = {
  name: string;
  used: number;
  input: number;
  output: number;
  color: string;
};

type SingleAgentUsageRow = AgentRangeUsage & {
  assignmentId?: string;
  limit: number;
  left: number;
  grantUsed: number;
};

// Range usage plus, for a team, the agent's own slice of the grant: the
// team's limit is applied to EACH agent, so limit / used / left are tracked
// per agent (AssignedTeamAgent). Memberships still share one allowance and
// leave these unset.
type GroupAgentUsage = AgentRangeUsage & {
  limit?: number | null;
  grantUsed?: number;
  /** Teams only: input / output split of grantUsed on the agent's grant row. */
  grantInput?: number;
  grantOutput?: number;
  left?: number | null;
};

// One team or membership grant and the agents it reaches. For a membership
// the allowance is shared and sits on the group; for a team `limit` is the
// per-agent allowance and `used` / `left` are the sums across its agents.
type GroupUsageSection = {
  id: string;
  name: string;
  /** The AgentTeam behind a team grant; what the per-agent usage endpoint is keyed on. */
  teamId?: string;
  limit: number | null;
  used: number;
  left: number | null;
  /** Shared pools only: start of the 30-day cycle the figures belong to. */
  cycleStartsAt?: string | null;
  agents: GroupAgentUsage[];
  /** True when limit / used / left are tracked per agent (teams). */
  perAgent: boolean;
};

const emptyRangeUsage = (name: string): AgentRangeUsage => ({
  name,
  used: 0,
  input: 0,
  output: 0,
  color: getAgentUsageColor(name),
});

const toRangeUsage = (
  name: string,
  usageByAgent: Map<string, AgentTokenUsageRow>,
): AgentRangeUsage => {
  const row = usageByAgent.get(name);
  return row
    ? { name, used: row.used, input: row.input, output: row.output, color: row.color }
    : emptyRangeUsage(name);
};

const buildSingleAgentUsage = (
  details: ApiUserDetails | null,
  usageByAgent: Map<string, AgentTokenUsageRow>,
): SingleAgentUsageRow[] => {
  const quotaByAgent = new Map<string, ApiAgentQuota>();
  (details?.agentQuotas ?? []).forEach((quota) => {
    if (quota.agentName) quotaByAgent.set(quota.agentName, quota);
  });

  return (details?.user.agents ?? [])
    .filter(isActiveAssignment)
    .filter((grant): grant is ApiAssignment & { agentName: string } => Boolean(grant.agentName))
    .map((grant) => {
      const quota = quotaByAgent.get(grant.agentName);
      // The grant's own allowance wins; the cycle quota is the fallback for
      // grants created before tokenLimit existed on the row.
      const limit = grant.tokenLimit ?? quota?.limit ?? 0;
      const grantUsed = grant.usedTokens ?? quota?.cycleUsedTokens ?? 0;
      const left = grant.tokensLeft ?? quota?.tokensLeft ?? Math.max(0, limit - grantUsed);
      const range = toRangeUsage(grant.agentName, usageByAgent);
      // Like team agents, usage / input / output come from the grant row that
      // the chat tracker updates; the range log is only a fallback for grants
      // that predate the per-grant rollup.
      return {
        ...range,
        used: grant.usedTokens ?? range.used,
        input: grant.inputTokens ?? range.input,
        output: grant.outputTokens ?? range.output,
        assignmentId: grant.id,
        limit,
        left,
        grantUsed,
      };
    })
    .sort((a, b) => b.used - a.used);
};

const buildTeamUsage = (
  details: ApiUserDetails | null,
  usageByAgent: Map<string, AgentTokenUsageRow>,
): GroupUsageSection[] =>
  (details?.user.teams ?? [])
    .filter(isActiveAssignment)
    .map((grant, index) => {
      const agentNames = (grant.team?.agents ?? [])
        .map((item) => item.agentName)
        .filter((name): name is string => Boolean(name));
      // The grant's per-agent rows carry each agent's own limit and spend.
      const grantByAgent = new Map<string, ApiTeamAgentGrant>();
      (grant.agents ?? []).forEach((row) => {
        if (row.agentName) grantByAgent.set(row.agentName, row);
      });
      // Every agent in the team gets the grant's tokenLimit; an agent row
      // written by the server wins, the grant figure covers rows that
      // predate the per-agent split.
      const perAgentLimit = grant.tokenLimit ?? null;

      const agents: GroupAgentUsage[] = agentNames.map((name) => {
        const row = grantByAgent.get(name);
        const limit = row?.tokenLimit ?? perAgentLimit;
        const grantUsed = row?.usedTokens ?? 0;
        const left = row?.tokensLeft ?? (limit === null ? null : Math.max(0, limit - grantUsed));
        return {
          ...toRangeUsage(name, usageByAgent),
          limit,
          grantUsed,
          grantInput: row?.inputTokens ?? 0,
          grantOutput: row?.outputTokens ?? 0,
          left,
        };
      });

      const used = agents.reduce((sum, agent) => sum + (agent.grantUsed ?? 0), 0);
      const lefts = agents.map((agent) => agent.left).filter((v): v is number => typeof v === "number");
      const left = lefts.length === 0 ? null : lefts.reduce((sum, v) => sum + v, 0);
      return {
        id: grant.id ?? `team-${index}`,
        name: grant.team?.name ?? "Team",
        teamId: grant.teamId ?? grant.team?.id,
        limit: perAgentLimit,
        used,
        left,
        agents: agents.sort((a, b) => b.used - a.used),
        perAgent: true,
      };
    });

const buildMembershipUsage = (
  details: ApiUserDetails | null,
  usageByAgent: Map<string, AgentTokenUsageRow>,
): GroupUsageSection[] =>
  (details?.user.memberships ?? [])
    .filter(isActiveAssignment)
    .map((grant, index) => {
      const names = new Set<string>();
      grant.template?.includedAgents?.forEach((name) => names.add(name));
      grant.template?.includedTeams?.forEach((link) => {
        if (link.team?.isActive === false) return;
        link.team?.agents?.forEach((item) => item.agentName && names.add(item.agentName));
      });
      const agents = Array.from(names).map((name) => toRangeUsage(name, usageByAgent));
      const limit = grant.monthlyTokenLimit ?? grant.template?.monthlyTokenLimit ?? null;
      // The grant's shared pool is what the server enforces: one rollup that
      // every agent's chat moves, for the current 30-day cycle. The sum of
      // the range usage is only the fallback for a grant written before the
      // pool existed.
      const used = grant.usedTokens ?? agents.reduce((sum, agent) => sum + agent.used, 0);
      const left = grant.tokensLeft ?? (limit === null ? null : Math.max(0, limit - used));
      return {
        id: grant.id ?? `membership-${index}`,
        name: grant.template?.name ?? "Membership",
        limit,
        used,
        left,
        cycleStartsAt: grant.cycleStartsAt ?? null,
        agents: agents.sort((a, b) => b.used - a.used),
        perAgent: false,
      };
    });

type GroupUsageBlockProps = {
  icon: React.ReactNode;
  label: string;
  accent: "violet" | "emerald";
  emptyText: string;
  limitLabel: string;
  sections: GroupUsageSection[];
  activeLabel: string;
  /**
   * Per-agent sections only: replaces the "Used (grant)" cell so the page can
   * put an inline usage editor next to the figure. Memberships have no
   * per-agent grant to edit and never call it.
   */
  renderGrantUsedCell?: (section: GroupUsageSection, agent: GroupAgentUsage) => React.ReactNode;
};

const GROUP_ACCENT = {
  violet: { heading: "text-violet-300/70", count: "bg-violet-500/10 text-violet-300/60", name: "text-violet-300", bar: "bg-violet-500" },
  emerald: { heading: "text-emerald-300/70", count: "bg-emerald-500/10 text-emerald-300/60", name: "text-emerald-300", bar: "bg-emerald-500" },
} as const;

type UsedTokensDrawerProps = {
  open: boolean;
  section: GroupUsageSection | null;
  accent: keyof typeof GROUP_ACCENT;
  limitLabel: string;
  activeLabel: string;
  onClose: () => void;
};

// Side panel breaking a team / membership's used tokens down by agent. Teams
// show each agent's spend on its own grant slice; memberships have one pool,
// so the per-agent split comes from the selected range's usage instead.
const UsedTokensDrawer = ({ open, section, accent, limitLabel, activeLabel, onClose }: UsedTokensDrawerProps) => {
  const tone = GROUP_ACCENT[accent];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = (section?.agents ?? [])
    .map((agent) => ({
      agent,
      used: section?.perAgent ? agent.grantUsed ?? 0 : agent.used,
      input: section?.perAgent ? agent.grantInput ?? 0 : agent.input,
      output: section?.perAgent ? agent.grantOutput ?? 0 : agent.output,
    }))
    .sort((a, b) => b.used - a.used);
  const active = rows.filter((row) => row.used > 0);
  const idle = rows.filter((row) => row.used <= 0);
  const agentsTotal = rows.reduce((sum, row) => sum + row.used, 0);
  const inputTotal = rows.reduce((sum, row) => sum + row.input, 0);
  const outputTotal = rows.reduce((sum, row) => sum + row.output, 0);
  const ioTotal = inputTotal + outputTotal;
  const inputShare = ioTotal > 0 ? (inputTotal / ioTotal) * 100 : 0;

  const poolLimit =
    !section || section.limit === null
      ? null
      : section.perAgent
        ? section.limit * section.agents.length
        : section.limit;
  const percent =
    section && poolLimit && poolLimit > 0 ? Math.min(100, (section.used / poolLimit) * 100) : 0;
  const scopeLabel = section?.perAgent ? "on this grant" : activeLabel;

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={section ? `Used tokens for ${section.name}` : "Used tokens"}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-slate-950 shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {section && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Used tokens</p>
                <p className={`mt-0.5 text-lg font-semibold ${tone.name}`}>{section.name}</p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {section.perAgent ? "Team" : "Membership"} · {section.agents.length} agents
                  {!section.perAgent && section.cycleStartsAt && <> · cycle from {formatDate(section.cycleStartsAt)}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close used tokens panel"
                className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Totals */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/5 bg-white/3 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Used</p>
                  <p className="mt-1 font-mono text-base text-white">{section.used.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/3 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    {section.perAgent ? "Total limit" : limitLabel}
                  </p>
                  <p className="mt-1 font-mono text-base text-white/80">
                    {poolLimit === null ? "—" : poolLimit.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/4 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Left</p>
                  <p className="mt-1 font-mono text-base text-emerald-300">
                    {section.left === null ? "—" : section.left.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} />
                </span>
                <span className="text-[11px] text-white/40">{percent.toFixed(1)}% of limit used</span>
              </div>

              {/* Input vs output */}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                  Input vs output <span className="normal-case text-white/25">({scopeLabel})</span>
                </p>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
                  <span className="h-full bg-sky-400" style={{ width: `${inputShare}%` }} />
                  <span className="h-full bg-amber-400" style={{ width: `${ioTotal > 0 ? 100 - inputShare : 0}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-white/50">
                    <span className="h-2 w-2 rounded-full bg-sky-400" /> Input
                    <span className="font-mono text-white">{inputTotal.toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-white/50">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Output
                    <span className="font-mono text-white">{outputTotal.toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {/* Per agent */}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                  Used by agent <span className="normal-case text-white/25">({scopeLabel})</span>
                </p>
                {active.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/35">
                    No agent has used tokens yet
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {active.map(({ agent, used, input, output }) => {
                      const shareOfTotal = agentsTotal > 0 ? (used / agentsTotal) * 100 : 0;
                      const agentLimit = section.perAgent ? agent.limit ?? null : null;
                      const limitShare =
                        agentLimit && agentLimit > 0 ? Math.min(100, (used / agentLimit) * 100) : null;
                      return (
                        <li key={agent.name} className="rounded-lg border border-white/5 bg-white/3 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                              {agent.name}
                            </span>
                            <span className="font-mono text-sm text-white">{used.toLocaleString()}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${shareOfTotal}%`, backgroundColor: agent.color }}
                              />
                            </span>
                            <span className="w-12 text-right text-[11px] text-white/40">{shareOfTotal.toFixed(1)}%</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-white/40">
                            <span>In <span className="font-mono text-white/70">{input.toLocaleString()}</span></span>
                            <span>Out <span className="font-mono text-white/70">{output.toLocaleString()}</span></span>
                            {limitShare !== null && agentLimit !== null && (
                              <span>
                                {limitShare.toFixed(1)}% of its {agentLimit.toLocaleString()} limit
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {idle.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                    Not used yet <span className="normal-case text-white/25">({idle.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {idle.map(({ agent }) => (
                      <span
                        key={agent.name}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/3 px-2 py-1 text-[11px] text-white/50"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: agent.color }} />
                        {agent.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

// Memberships share one allowance across their agents, so the limit / left
// figures sit on the group header and agent rows carry only what each agent
// spent in the selected range. Teams apply their limit to EACH agent: the
// header shows the per-agent limit and the sums, and every agent row gets
// its own limit / used / left columns.
const GroupUsageBlock = ({ icon, label, accent, emptyText, limitLabel, sections, activeLabel, renderGrantUsedCell }: GroupUsageBlockProps) => {
  const tone = GROUP_ACCENT[accent];
  // The section id outlives closing so the panel keeps its content while it
  // slides out.
  const [drawerSectionId, setDrawerSectionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerSection = sections.find((section) => section.id === drawerSectionId) ?? null;
  const openDrawer = (id: string) => {
    setDrawerSectionId(id);
    setDrawerOpen(true);
  };

  return (
    <div>
      <UsedTokensDrawer
        open={drawerOpen && drawerSection !== null}
        section={drawerSection}
        accent={accent}
        limitLabel={limitLabel}
        activeLabel={activeLabel}
        onClose={() => setDrawerOpen(false)}
      />
      <p className={`mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${tone.heading}`}>
        {icon} {label}
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${tone.count}`}>{sections.length}</span>
      </p>
      {sections.length === 0 ? (
        <span className="text-xs text-white/30">{emptyText}</span>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => {
            // For a team the pool is limit × agents, since each agent owns
            // the full limit.
            const poolLimit =
              section.limit === null
                ? null
                : section.perAgent
                  ? section.limit * section.agents.length
                  : section.limit;
            const percent =
              poolLimit && poolLimit > 0 ? Math.min(100, (section.used / poolLimit) * 100) : 0;
            return (
              <div key={section.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <button
                    type="button"
                    onClick={() => openDrawer(section.id)}
                    title="Show used tokens breakdown"
                    className={`text-sm font-semibold ${tone.name} underline-offset-4 hover:underline`}
                  >
                    {section.name}
                  </button>
                  {!section.perAgent && section.cycleStartsAt && (
                    <span className="text-[11px] text-white/40">
                      Cycle from{" "}
                      <span className="font-mono text-white/70">{formatDate(section.cycleStartsAt)}</span>
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/5 bg-white/3 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">
                      {section.perAgent ? `${limitLabel} (per agent)` : `${limitLabel} (shared)`}
                    </p>
                    <p className="mt-1 font-mono text-lg text-white">
                      {section.limit === null ? "Access only" : section.limit.toLocaleString()}
                    </p>
                    {section.perAgent && poolLimit !== null && (
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {section.agents.length} agents × {section.limit?.toLocaleString()} = {poolLimit.toLocaleString()}
                      </p>
                    )}
                    {!section.perAgent && section.agents.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-white/35">
                        One pool for all {section.agents.length} agents
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openDrawer(section.id)}
                    title="Show used tokens breakdown"
                    className="group rounded-lg border border-white/5 bg-white/3 px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/5"
                  >
                    <p className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
                      Used
                      <span className="normal-case tracking-normal text-white/30 transition group-hover:text-white/60">
                        View breakdown →
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-lg text-white">{section.used.toLocaleString()}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} />
                      </span>
                      <span className="text-[11px] text-white/35">{percent.toFixed(1)}%</span>
                    </div>
                  </button>
                  <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/4 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Tokens left</p>
                    <p className="mt-1 font-mono text-lg text-emerald-300">
                      {section.left === null ? "—" : section.left.toLocaleString()}
                    </p>
                    {poolLimit !== null && section.left !== null && (
                      <p className="mt-0.5 text-[11px] text-white/35">
                        of {poolLimit.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                {section.agents.length === 0 ? (
                  <span className="mt-2 block text-[11px] text-white/25">No agents in this {label.toLowerCase().replace(/s$/, "")}</span>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className={`w-full ${section.perAgent ? "min-w-[900px]" : "min-w-[560px]"} text-left text-sm`}>
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
                          <th className="pb-2 font-medium">Agent Name</th>
                          <th className="pb-2 font-medium">Usage ({activeLabel})</th>
                          <th className="pb-2 font-medium">Input ({activeLabel})</th>
                          <th className="pb-2 font-medium">Output ({activeLabel})</th>
                          {section.perAgent && (
                            <>
                              <th className="pb-2 font-medium">Token Limit</th>
                              <th className="pb-2 font-medium">Used (grant)</th>
                              <th className="pb-2 font-medium">Tokens Left</th>
                              <th className="pb-2 font-medium">Limit used</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {section.agents.map((agent) => {
                          // Teams: how much of the agent's OWN limit is gone.
                          // Memberships have one shared pool, shown on the header.
                          const agentLimit = agent.limit ?? null;
                          const grantUsed = agent.grantUsed ?? 0;
                          const share =
                            agentLimit && agentLimit > 0
                              ? Math.min(100, (grantUsed / agentLimit) * 100)
                              : 0;
                          const barColor =
                            share >= 90 ? "#f87171" : share >= 70 ? "#fbbf24" : agent.color;
                          return (
                            <tr key={agent.name} className="border-b border-white/5 last:border-0">
                              <td className="py-2.5">
                                <span className="inline-flex items-center gap-2 font-semibold text-sky-300">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                                  {agent.name}
                                </span>
                              </td>
                              <td className="py-2.5 font-mono text-white">{agent.used.toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-white/60">{agent.input.toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-white/60">{agent.output.toLocaleString()}</td>
                              {section.perAgent && (
                                <>
                                  <td className="py-2.5 font-mono text-white/80">
                                    {agentLimit === null ? <span className="text-white/35">Access only</span> : agentLimit.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 font-mono text-white">
                                    {renderGrantUsedCell ? renderGrantUsedCell(section, agent) : grantUsed.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 font-mono text-emerald-300">
                                    {agent.left === null || agent.left === undefined ? "—" : agent.left.toLocaleString()}
                                  </td>
                                  <td className="py-2.5">
                                    <div className="flex items-center gap-3">
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                                        <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: barColor }} />
                                      </div>
                                      <span className="text-[11px] text-white/35">{share.toFixed(1)}%</span>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const generateDailyData = () => {
  const days: DailyUsagePoint[] = [];
  for (let i = 1; i <= 30; i++) {
    days.push({ date: `Day ${i}`, total: 0, stops: 0 });
  }
  return days;
};
const MOCK_DAILY_USAGE = generateDailyData();

const MOCK_WEEKLY_USAGE: DailyUsagePoint[] = [
  { date: "Week 1", week: "Week 1", total: 0, stops: 0 },
  { date: "Week 2", week: "Week 2", total: 0, stops: 0 },
  { date: "Week 3", week: "Week 3", total: 0, stops: 0 },
  { date: "Week 4", week: "Week 4", total: 0, stops: 0 },
];

const MOCK_AGENT_USAGE = [
  { name: "SARA_AI", value: 0, color: "#38bdf8" },
  { name: "JIM",     value: 0, color: "#f472b6" },
];

const totalStops = MOCK_DAILY_USAGE.reduce((s, d) => s + d.stops, 0);

const formatUsageDate = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const buildUsedAgentSeries = (
  details: ApiUserDetails | null,
  agentTokenUsage: AgentTokenUsageRow[],
): AgentUsageSeries[] => {
  const agentNames = new Set<string>(collectAssignedAgentNames(details));

  agentTokenUsage.forEach((agent) => {
    agentNames.add(agent.name);
  });

  collectChartUsageRows(details).forEach((item) => {
    if (item.agentName) {
      agentNames.add(item.agentName);
    }
  });

  return Array.from(agentNames).map((name) => ({
    name,
    color:
      agentTokenUsage.find((agent) => agent.name === name)?.color ??
      getAgentUsageColor(name),
  }));
};

const buildDailyUsageData = (
  details: ApiUserDetails | null,
  series: AgentUsageSeries[],
  agentTokenUsage: AgentTokenUsageRow[],
  usageRange?: UsageDateRange,
): DailyUsagePoint[] => {
  const seriesNames = new Set(series.map((item) => item.name));
  const rows = collectChartUsageRows(details).filter(
    (item) => item.agentName && seriesNames.has(item.agentName),
  );
  const buildEmptyPoint = (dateKey: string): DailyUsagePoint => {
    const point: DailyUsagePoint = {
      dateKey,
      date: formatUsageDate(dateKey),
      total: 0,
      stops: 0,
    };
    series.forEach((agent) => {
      point[agent.name] = 0;
      point[inputKey(agent.name)] = 0;
      point[outputKey(agent.name)] = 0;
    });
    return point;
  };
  const buildRangePoints = () => {
    if (!usageRange) return null;

    const points: DailyUsagePoint[] = [];
    let current = startOfLocalDay(usageRange.from);
    const end = startOfLocalDay(usageRange.to);

    while (current <= end && points.length < 367) {
      points.push(buildEmptyPoint(formatDateParam(current)));
      current = addDays(current, 1);
    }

    return points;
  };

  if (!rows.length) {
    const rangePoints = buildRangePoints();
    if (rangePoints) return rangePoints;
    if (!series.length) return MOCK_DAILY_USAGE;

    const totalPoint: DailyUsagePoint = { date: "Total", total: 0, stops: 0 };
    series.forEach((agent) => {
      const agentUsage = agentTokenUsage.find((item) => item.name === agent.name);
      const used = agentUsage?.used ?? 0;
      totalPoint[agent.name] = used;
      totalPoint[inputKey(agent.name)] = agentUsage?.input ?? 0;
      totalPoint[outputKey(agent.name)] = agentUsage?.output ?? 0;
      totalPoint.total = Number(totalPoint.total) + used;
    });

    return [totalPoint];
  }

  const grouped = new Map<string, DailyUsagePoint>();

  rows.forEach((item) => {
    if (!item.date || !item.agentName) return;

    const dateKey = item.date.slice(0, 10);
    const tokens = item.totalTokens ?? 0;
    const inputTokens = item.inputTokens ?? 0;
    const outputTokens = item.outputTokens ?? 0;
    const current = grouped.get(dateKey) ?? {
      dateKey,
      date: formatUsageDate(item.date),
      total: 0,
      stops: 0,
    };

    current[item.agentName] = Number(current[item.agentName] ?? 0) + tokens;
    current[inputKey(item.agentName)] = Number(current[inputKey(item.agentName)] ?? 0) + inputTokens;
    current[outputKey(item.agentName)] = Number(current[outputKey(item.agentName)] ?? 0) + outputTokens;
    current.total = Number(current.total) + tokens;
    grouped.set(dateKey, current);
  });

  const sortedPoints = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => {
      series.forEach((agent) => {
        value[agent.name] = Number(value[agent.name] ?? 0);
        value[inputKey(agent.name)] = Number(value[inputKey(agent.name)] ?? 0);
        value[outputKey(agent.name)] = Number(value[outputKey(agent.name)] ?? 0);
      });
      return value;
    });

  if (!usageRange) return sortedPoints;

  const pointsByDateKey = new Map(sortedPoints.map((point) => [String(point.dateKey), point]));
  const rangePoints = buildRangePoints();
  return rangePoints?.map((point) => pointsByDateKey.get(String(point.dateKey)) ?? point) ?? sortedPoints;
};

const buildWeeklyUsageData = (
  dailyUsage: DailyUsagePoint[],
  series: AgentUsageSeries[],
): DailyUsagePoint[] => {
  if (!series.length) return MOCK_WEEKLY_USAGE;

  const grouped = new Map<number, DailyUsagePoint>();
  const weekDays = new Map<number, DailyUsagePoint[]>();

  dailyUsage.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    weekDays.set(weekIndex, [...(weekDays.get(weekIndex) ?? []), day]);
    const current = grouped.get(weekIndex) ?? {
      date: `Week ${weekIndex + 1}`,
      week: `Week ${weekIndex + 1}`,
      total: 0,
      stops: 0,
    };

    series.forEach((agent) => {
      current[agent.name] =
        Number(current[agent.name] ?? 0) + Number(day[agent.name] ?? 0);
      current[inputKey(agent.name)] =
        Number(current[inputKey(agent.name)] ?? 0) + Number(day[inputKey(agent.name)] ?? 0);
      current[outputKey(agent.name)] =
        Number(current[outputKey(agent.name)] ?? 0) + Number(day[outputKey(agent.name)] ?? 0);
    });
    current.total = Number(current.total) + Number(day.total ?? 0);
    current.stops = Number(current.stops) + Number(day.stops ?? 0);
    grouped.set(weekIndex, current);
  });

  // Weeks are 7-day buckets from the range start, so name each by its real
  // dates ("Sep 1 – Sep 7"); a bare "Week N" hides which days it covers.
  grouped.forEach((point, weekIndex) => {
    const days = (weekDays.get(weekIndex) ?? []).filter((day) => day.dateKey);
    if (!days.length) return;
    const first = String(days[0].date);
    const last = String(days[days.length - 1].date);
    const label = first === last ? first : `${first} – ${last}`;
    point.date = label;
    point.week = label;
  });

  return Array.from(grouped.values());
};

const buildDisplayUsageData = (
  usageData: DailyUsagePoint[],
  series: AgentUsageSeries[],
  currency: CurrencyMode,
): DailyUsagePoint[] => {
  if (currency === "tokens") return usageData;

  const currencyMultiplier = currency === "EUR" ? EUR_RATE : 1;
  return usageData.map((point) => {
    const displayPoint: DailyUsagePoint = { ...point, total: 0 };

    series.forEach((agent) => {
      const cost =
        getClaudeSonnet46Usd(
          Number(point[inputKey(agent.name)] ?? 0),
          Number(point[outputKey(agent.name)] ?? 0),
        ) * currencyMultiplier;
      displayPoint[agent.name] = cost;
      displayPoint.total = Number(displayPoint.total) + cost;
    });

    return displayPoint;
  });
};

/* ─────── TIMEFRAME PRESETS ─────── */
const PRESETS = [
  { label: "Today",       value: "today" },
  { label: "Yesterday",   value: "yesterday" },
  { label: "Last 7 Days", value: "last_7" },
  { label: "This Week",   value: "this_week" },
  { label: "Last Week",   value: "last_week" },
  { label: "This Month",  value: "this_month" },
  { label: "Last Month",  value: "last_month" },
];

/* ─────── COMPONENT ─────── */
type UsageDateRange = {
  from: Date;
  to: Date;
  label: string;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatRangeLabel = (from: Date, to: Date) =>
  `${formatDateParam(from)} -> ${formatDateParam(to)}`;

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const normalizeRange = (from: Date, to: Date): UsageDateRange => {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  return start <= end
    ? { from: start, to: end, label: formatRangeLabel(start, end) }
    : { from: end, to: start, label: formatRangeLabel(end, start) };
};

const getPresetRange = (preset: string): UsageDateRange => {
  const today = startOfLocalDay(new Date());

  switch (preset) {
    case "today":
      return { from: today, to: today, label: "Today" };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday, label: "Yesterday" };
    }
    case "last_7":
      return { from: addDays(today, -6), to: today, label: "Last 7 Days" };
    case "this_week": {
      const mondayOffset = (today.getDay() + 6) % 7;
      return { from: addDays(today, -mondayOffset), to: today, label: "This Week" };
    }
    case "last_week": {
      const mondayOffset = (today.getDay() + 6) % 7;
      const thisWeekStart = addDays(today, -mondayOffset);
      return {
        from: addDays(thisWeekStart, -7),
        to: addDays(thisWeekStart, -1),
        label: "Last Week",
      };
    }
    case "last_month": {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: firstOfLastMonth, to: addDays(firstOfThisMonth, -1), label: "Last Month" };
    }
    case "this_month":
    default:
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
        label: "This Month",
      };
  }
};

const resolveUsageRange = (
  selectedPreset: string,
  appliedCustomDays: string,
  appliedCustomFrom: string,
  appliedCustomTo: string,
): UsageDateRange => {
  const parsedDays = Number.parseInt(appliedCustomDays, 10);
  if (Number.isFinite(parsedDays) && parsedDays > 0) {
    const days = Math.min(parsedDays, 366);
    const today = startOfLocalDay(new Date());
    return {
      from: addDays(today, -(days - 1)),
      to: today,
      label: `Last ${days} days`,
    };
  }

  const from = parseDateInput(appliedCustomFrom);
  const to = parseDateInput(appliedCustomTo);
  if (from && to) return normalizeRange(from, to);

  return getPresetRange(selectedPreset || "this_month");
};

export default function SingleUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  const [selectedPreset, setSelectedPreset] = useState("this_month");
  const [customDays, setCustomDays] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustomDays, setAppliedCustomDays] = useState("");
  const [appliedCustomFrom, setAppliedCustomFrom] = useState("");
  const [appliedCustomTo, setAppliedCustomTo] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [currency, setCurrency] = useState<CurrencyMode>("tokens");
  const [details, setDetails] = useState<ApiUserDetails | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [visibleAgents, setVisibleAgents] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [removing, setRemoving] = useState<PendingRemoval | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [editingTokenLimit, setEditingTokenLimit] = useState<{
    assignmentId: string;
    agentName: string;
    value: string;
  } | null>(null);
  const [savingTokenLimit, setSavingTokenLimit] = useState(false);
  const [tokenLimitError, setTokenLimitError] = useState<string | null>(null);
  // Inline editor on a team agent row: records a chat's input/output tokens
  // against that one agent of the team grant.
  const [editingTeamUsage, setEditingTeamUsage] = useState<{
    teamId: string;
    teamName: string;
    agentName: string;
    inputTokens: string;
    outputTokens: string;
  } | null>(null);
  const [savingTeamUsage, setSavingTeamUsage] = useState(false);
  const [teamUsageError, setTeamUsageError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const usageRange = useMemo(
    () => resolveUsageRange(selectedPreset, appliedCustomDays, appliedCustomFrom, appliedCustomTo),
    [selectedPreset, appliedCustomDays, appliedCustomFrom, appliedCustomTo],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Escape closes the remove dialog, but not while the request is in flight.
  useEffect(() => {
    if (!pendingRemoval) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !removing) setPendingRemoval(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pendingRemoval, removing]);

  useEffect(() => {
    const controller = new AbortController();

    const loadUserDetails = async () => {
      setIsLoadingUser(true);
      setUserError(null);

      try {
        const query = new URLSearchParams({
          usageFrom: formatDateParam(usageRange.from),
          usageTo: formatDateParam(usageRange.to),
        });

        const response = await authenticatedFetch(`${API_BASE}/admin/dashboard/users/${resolvedParams.id}?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`User details request failed with ${response.status}`);
        }

        setDetails((await response.json()) as ApiUserDetails);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setUserError((err as Error).message || "Failed to load user details");
          setDetails(null);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingUser(false);
      }
    };

    loadUserDetails();
    return () => controller.abort();
  }, [resolvedParams.id, usageRange, reloadKey]);

  const activeLabel = usageRange.label;

  const handlePreset = (value: string) => {
    setSelectedPreset(value);
    setCustomDays("");
    setCustomFrom("");
    setCustomTo("");
    setAppliedCustomDays("");
    setAppliedCustomFrom("");
    setAppliedCustomTo("");
    setShowPicker(false);
  };

  const handleCustomDays = () => {
    const parsedDays = Number.parseInt(customDays, 10);
    if (Number.isFinite(parsedDays) && parsedDays > 0) {
      setSelectedPreset("");
      setAppliedCustomDays(String(parsedDays));
      setAppliedCustomFrom("");
      setAppliedCustomTo("");
      setCustomFrom("");
      setCustomTo("");
      setShowPicker(false);
    }
  };

  const handleCustomRange = () => {
    if (parseDateInput(customFrom) && parseDateInput(customTo)) {
      setSelectedPreset("");
      setAppliedCustomDays("");
      setAppliedCustomFrom(customFrom);
      setAppliedCustomTo(customTo);
      setCustomDays("");
      setShowPicker(false);
    }
  };

  const agentTokenUsage = useMemo(() => buildAgentTokenUsage(details), [details]);
  // Per-tier views of the same range usage: each grant is shown under the
  // tier that carries its allowance, so an agent reached two ways appears twice.
  const usageByAgent = useMemo(
    () => new Map(agentTokenUsage.map((row) => [row.name, row])),
    [agentTokenUsage],
  );
  const singleAgentUsage = useMemo(() => buildSingleAgentUsage(details, usageByAgent), [details, usageByAgent]);
  const teamUsage = useMemo(() => buildTeamUsage(details, usageByAgent), [details, usageByAgent]);
  const membershipUsage = useMemo(() => buildMembershipUsage(details, usageByAgent), [details, usageByAgent]);
  const usageSeries = useMemo(
    () => buildUsedAgentSeries(details, agentTokenUsage),
    [details, agentTokenUsage],
  );
  const visibleUsageSeries = useMemo(
    () => usageSeries.filter((agent) => visibleAgents.includes(agent.name)),
    [usageSeries, visibleAgents],
  );
  const dailyUsageData = useMemo(
    () => buildDailyUsageData(details, usageSeries, agentTokenUsage, usageRange),
    [details, usageSeries, agentTokenUsage, usageRange],
  );
  const weeklyUsageData = useMemo(
    () => buildWeeklyUsageData(dailyUsageData, usageSeries),
    [dailyUsageData, usageSeries],
  );
  const displayDailyUsageData = useMemo(
    () => buildDisplayUsageData(dailyUsageData, usageSeries, currency),
    [dailyUsageData, usageSeries, currency],
  );
  const displayWeeklyUsageData = useMemo(
    () => buildDisplayUsageData(weeklyUsageData, usageSeries, currency),
    [weeklyUsageData, usageSeries, currency],
  );
  // Summed from the same points the day chart plots, so team and single-agent
  // spend is in the donut too and the two always agree.
  const tokenUsageChartData = usageSeries
    .map((agent) => ({
      name: agent.name,
      value: displayDailyUsageData.reduce((sum, point) => sum + Number(point[agent.name] ?? 0), 0),
      color: agent.color,
    }))
    .filter((agent) => agent.value > 0);

  useEffect(() => {
    setVisibleAgents(usageSeries.map((agent) => agent.name));
  }, [usageSeries]);

  const toggleAgent = (agentName: string) => {
    setVisibleAgents((current) =>
      current.includes(agentName)
        ? current.filter((agent) => agent !== agentName)
        : [...current, agentName],
    );
  };

  const agentSelector = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
      {usageSeries.map((agent) => {
        const isVisible = visibleAgents.includes(agent.name);

        return (
          <button
            key={agent.name}
            type="button"
            onClick={() => toggleAgent(agent.name)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
              isVisible
                ? "border-white/15 bg-white/5 text-white"
                : "border-white/10 bg-white/[0.02] text-white/35"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full transition-opacity"
              style={{ backgroundColor: agent.color, opacity: isVisible ? 1 : 0.35 }}
            />
            {agent.name}
          </button>
        );
      })}
    </div>
  );
  const displayName = details?.user.username || details?.user.email?.split("@")[0] || (isLoadingUser ? "Loading user..." : "Unknown user");
  const displayEmail = details?.user.email ?? "";
  const displayOauthId = details?.user.oauthId ?? "";
  const joinedDate = formatDate(details?.user.createdAt);
  const stopCount = details?.user.stopLogs?.length ?? totalStops;
  const directAgents = collectDirectAgentNames(details);
  // Per-tier lists for the assignment cards. Expired/inactive grants are hidden.
  const activeMemberships = (details?.user.memberships ?? []).filter(isActiveAssignment);
  const activeTeams = (details?.user.teams ?? []).filter(isActiveAssignment);
  const activeAgents = (details?.user.agents ?? []).filter(isActiveAssignment);

  const beginTokenLimitEdit = (agentName: string, displayedLimit: number) => {
    const assignment = activeAgents.find(
      (item) => item.agentName === agentName && Boolean(item.id),
    );
    if (!assignment?.id) return;

    setTokenLimitError(null);
    setEditingTokenLimit({
      assignmentId: assignment.id,
      agentName,
      value: String(assignment.tokenLimit ?? displayedLimit),
    });
  };

  const saveTokenLimit = async () => {
    if (!editingTokenLimit || savingTokenLimit) return;

    const tokenLimit = Number(editingTokenLimit.value.trim());
    if (
      editingTokenLimit.value.trim() === "" ||
      !Number.isInteger(tokenLimit) ||
      tokenLimit < 0
    ) {
      setTokenLimitError("Token limit must be a non-negative integer.");
      return;
    }

    setSavingTokenLimit(true);
    setTokenLimitError(null);
    try {
      // The /token-limit route now records per-chat spend keyed on email +
      // agent. Setting an allowance goes through the assignment itself, which
      // re-derives tokensLeft from usedTokens the same way.
      const response = await authenticatedFetch(
        `${API_BASE}/admin/single-agent-assignments/${editingTokenLimit.assignmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenLimit }),
        },
      );

      if (!response.ok) {
        throw new Error(`Updating ${editingTokenLimit.agentName} failed with ${response.status}`);
      }

      setEditingTokenLimit(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setTokenLimitError((err as Error).message || "Failed to update token limit.");
    } finally {
      setSavingTokenLimit(false);
    }
  };

  const beginTeamUsageEdit = (section: GroupUsageSection, agentName: string) => {
    if (!section.teamId) return;
    setTeamUsageError(null);
    setEditingTeamUsage({
      teamId: section.teamId,
      teamName: section.name,
      agentName,
      inputTokens: "",
      outputTokens: "",
    });
  };

  const saveTeamUsage = async () => {
    if (!editingTeamUsage || savingTeamUsage || !displayEmail) return;

    // Both are signed deltas: a negative figure hands the allowance back.
    const parse = (raw: string) => (raw.trim() === "" ? 0 : Number(raw.trim()));
    const inputTokens = parse(editingTeamUsage.inputTokens);
    const outputTokens = parse(editingTeamUsage.outputTokens);
    if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens)) {
      setTeamUsageError("Input and output tokens must be whole numbers.");
      return;
    }
    if (inputTokens === 0 && outputTokens === 0) {
      setTeamUsageError("Enter the input and/or output tokens to record.");
      return;
    }

    setSavingTeamUsage(true);
    setTeamUsageError(null);
    try {
      const response = await authenticatedFetch(
        `${API_BASE}/admin/team-assignments/${encodeURIComponent(displayEmail)}/${editingTeamUsage.teamId}/${editingTeamUsage.agentName}/token-usage`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputTokens, outputTokens }),
        },
      );

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          if (typeof payload?.message === "string") detail = payload.message;
        } catch {
          /* body was not JSON */
        }
        throw new Error(
          detail || `Recording usage for ${editingTeamUsage.agentName} in ${editingTeamUsage.teamName} failed with ${response.status}`,
        );
      }

      setEditingTeamUsage(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setTeamUsageError((err as Error).message || "Failed to record team token usage.");
    } finally {
      setSavingTeamUsage(false);
    }
  };

  const requestRemoval = (item: PendingRemoval) => {
    if (!displayEmail || removing) return;
    setRemoveError(null);
    setPendingRemoval(item);
  };

  const confirmRemoval = async () => {
    const item = pendingRemoval;
    if (!displayEmail || !item || removing) return;

    setRemoving(item);
    setRemoveError(null);
    try {
      // Every kind is deactivated rather than deleted so usage history survives.
      let response: Response;
      if (item.kind === "agent") {
        // Direct grants are rows in SingleAssignedAgent, which only
        // /admin/single-agent-assignments may change; flip the row instead of deleting it.
        response = await authenticatedFetch(`${API_BASE}/admin/single-agent-assignments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
      } else if (item.kind === "team") {
        response = await authenticatedFetch(`${API_BASE}/admin/team-assignments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
      } else {
        response = await authenticatedFetch(`${API_BASE}/admin/memberships/assignments/${item.id}`, {
          method: "DELETE",
        });
      }
      if (!response.ok) {
        throw new Error(`Removing ${item.name} failed with ${response.status}`);
      }
      setReloadKey((key) => key + 1);
    } catch (err) {
      setRemoveError((err as Error).message || `Failed to remove ${item.name}`);
    } finally {
      setRemoving(null);
      setPendingRemoval(null);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Back link */}
      <Link href="/dashboard/admin/users" className="mb-6 inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition">
        <ArrowLeft size={16} /> Back to Users
      </Link>
      {userError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {userError}
        </div>
      )}

      {/* ──────── HEADER ROW ──────── */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        {/* User identity */}
        <div className="flex items-start gap-5">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-400 ring-1 ring-white/10">
            <UserIcon size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
              <span className="flex items-center gap-1"><Mail size={13} /> {displayEmail}</span>
              <span className="flex items-center gap-1"><Hash size={13} /> {displayOauthId}</span>
              <span className="flex items-center gap-1"><Calendar size={13} /> Joined {joinedDate}</span>
            </div>
          </div>
        </div>

        {/* ──────── REFRESH + TIMEFRAME SELECTOR ──────── */}
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={isLoadingUser}
          title="Refresh"
          aria-label="Refresh user data"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/10 bg-[#0F172A] text-sky-400 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={isLoadingUser ? "animate-spin" : ""} />
        </button>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition"
          >
            <Calendar size={15} className="text-sky-400" />
            <span className="font-medium">{activeLabel}</span>
            <ChevronDown size={14} className={`text-white/40 transition-transform ${showPicker ? "rotate-180" : ""}`} />
          </button>

          {showPicker && (
            <div className="absolute right-0 top-full mt-2 z-50 w-[380px] rounded-2xl border border-white/10 bg-[#0B1221] p-5 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Presets</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => handlePreset(p.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      selectedPreset === p.value
                        ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                        : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Last N Days</p>
              <div className="flex gap-2 mb-5">
                <input
                  type="number" min={1} placeholder="e.g. 14" value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-sky-500"
                />
                <button onClick={handleCustomDays} className="rounded-lg bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">Apply</button>
              </div>

              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Custom Range</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-white/40 mb-1 block">From</label>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/40 mb-1 block">To</label>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500" />
                </div>
                <button onClick={handleCustomRange} className="rounded-lg bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">Go</button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* ──────── ASSIGNMENTS BY TIER ──────── */}
      {/* One card per tier -- membership, team, single agent -- so an admin can
          see which grant an agent comes from. Each card can revoke its grant. */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Memberships */}
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1">
            <CreditCard size={11} /> Memberships
            <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{activeMemberships.length}</span>
          </p>
          {activeMemberships.length === 0 ? (
            <span className="text-xs text-white/35">No active membership</span>
          ) : (
            <div className="space-y-3">
              {activeMemberships.map((assignment, index) => {
                const template = assignment.template;
                const singleAgents = template?.includedAgents ?? [];
                const memberTeams = (template?.includedTeams ?? [])
                  .map((link) => link.team)
                  .filter((team): team is NonNullable<typeof team> => Boolean(team));
                const limit = assignment.monthlyTokenLimit ?? template?.monthlyTokenLimit ?? null;
                // One pool for every agent the membership reaches.
                const poolUsed = assignment.usedTokens ?? 0;
                const poolLeft = assignment.tokensLeft ?? (limit === null ? null : Math.max(0, limit - poolUsed));
                const poolPercent = limit && limit > 0 ? Math.min(100, (poolUsed / limit) * 100) : 0;
                return (
                  <div key={assignment.id ?? `${template?.name ?? "membership"}-${index}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-emerald-300">{template?.name ?? "Membership"}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {limit !== null && (
                          <span className="font-mono text-[10px] text-white/45" title="Shared by every agent in the membership">
                            {limit.toLocaleString()} tok/mo shared
                          </span>
                        )}
                        {assignment.id && (
                          <RemoveButton
                            label={`Remove membership ${template?.name ?? ""}`}
                            busy={removing?.kind === "membership" && removing.id === assignment.id}
                            disabled={Boolean(removing)}
                            onClick={() => requestRemoval({ kind: "membership", id: assignment.id!, name: template?.name ?? "Membership" })}
                            className="text-emerald-400/60"
                          />
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      {formatDate(assignment.startsAt)} → {formatDate(assignment.expiresAt)}
                    </p>
                    {limit !== null && (
                      <div className="mt-2 rounded-md border border-emerald-500/10 bg-emerald-500/[0.04] px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-white/40">
                            Pool used <span className="font-mono text-white">{poolUsed.toLocaleString()}</span>
                            <span className="text-white/30"> / {limit.toLocaleString()}</span>
                          </span>
                          <span className="text-white/40">
                            Left{" "}
                            <span className="font-mono text-emerald-300">
                              {poolLeft === null ? "—" : poolLeft.toLocaleString()}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${poolPercent >= 90 ? "bg-red-400" : poolPercent >= 70 ? "bg-amber-400" : "bg-emerald-500"}`}
                            style={{ width: `${poolPercent}%` }}
                          />
                        </div>
                        {assignment.cycleStartsAt && (
                          <p className="mt-1 text-[10px] text-white/30">Cycle from {formatDate(assignment.cycleStartsAt)} · all agents share this pool</p>
                        )}
                      </div>
                    )}
                    <div className="mt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] uppercase tracking-wide text-white/30">Agents</span>
                        {singleAgents.length === 0 && <span className="text-[10px] text-white/25">none</span>}
                        {singleAgents.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 ring-1 ring-sky-500/20">
                            <Bot size={10} /> {a}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] uppercase tracking-wide text-white/30">Teams</span>
                        {memberTeams.length === 0 && <span className="text-[10px] text-white/25">none</span>}
                        {memberTeams.map((team, teamIndex) => {
                          const agentNames = (team.agents ?? [])
                            .map((item) => item.agentName)
                            .filter((name): name is string => Boolean(name));
                          return (
                            <span
                              key={team.id ?? `${team.name ?? "team"}-${teamIndex}`}
                              title={agentNames.join(", ")}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ring-1 ${
                                team.isActive === false
                                  ? "bg-white/5 text-white/35 ring-white/10 line-through"
                                  : "bg-violet-500/10 text-violet-300 ring-violet-500/20"
                              }`}
                            >
                              <Users size={10} /> {team.name ?? "Team"} ({agentNames.length})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1">
            <Users size={11} /> Teams
            <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{activeTeams.length}</span>
          </p>
          {activeTeams.length === 0 ? (
            <span className="text-xs text-white/35">No active team assignment</span>
          ) : (
            <div className="space-y-3">
              {activeTeams.map((assignment, index) => {
                const agentNames = (assignment.team?.agents ?? [])
                  .map((item) => item.agentName)
                  .filter((name): name is string => Boolean(name));
                return (
                  <div key={assignment.id ?? `${assignment.team?.name ?? "team"}-${index}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-violet-300">{assignment.team?.name ?? "Team"}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {typeof assignment.tokenLimit === "number" && (
                          <span className="font-mono text-[10px] text-white/45">{assignment.tokenLimit.toLocaleString()} tok</span>
                        )}
                        {assignment.id && (
                          <RemoveButton
                            label={`Remove team ${assignment.team?.name ?? ""}`}
                            busy={removing?.kind === "team" && removing.id === assignment.id}
                            disabled={Boolean(removing)}
                            onClick={() => requestRemoval({ kind: "team", id: assignment.id!, name: assignment.team?.name ?? "Team" })}
                            className="text-violet-400/60"
                          />
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      {formatDate(assignment.startsAt)} → {formatDate(assignment.expiresAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {agentNames.length === 0 && <span className="text-[10px] text-white/25">no agents</span>}
                      {agentNames.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 ring-1 ring-sky-500/20">
                          <Bot size={10} /> {a}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Single agents */}
        <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1">
            <Shield size={11} /> Single Agents
            <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{activeAgents.length}</span>
          </p>
          {activeAgents.length === 0 ? (
            <span className="text-xs text-white/35">No directly assigned agents</span>
          ) : (
            <div className="space-y-2">
              {activeAgents.map((assignment, index) => {
                const name = assignment.agentName ?? "";
                const isRemoving = removing?.kind === "agent" && removing.id === assignment.id;
                return (
                  <div key={assignment.id ?? `${name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
                        <Bot size={13} /> {name}
                      </span>
                      <p className="mt-0.5 text-[10px] text-white/40">
                        {formatDate(assignment.startsAt)} → {formatDate(assignment.expiresAt)}
                        {typeof assignment.monthlyTokenLimit === "number" && (
                          <span className="ml-2 font-mono">{assignment.monthlyTokenLimit.toLocaleString()} tok</span>
                        )}
                      </p>
                    </div>
                    {name && assignment.id && directAgents.includes(name) && (
                      <RemoveButton
                        label={`Remove ${name}`}
                        busy={isRemoving}
                        disabled={Boolean(removing)}
                        onClick={() => requestRemoval({ kind: "agent", id: assignment.id!, name })}
                        className="text-sky-400/60"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {removeError && <p className="-mt-4 mb-6 text-xs text-red-400">{removeError}</p>}

      {/* Agent token usage, split by the tier that carries the allowance */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1"><Bot size={11} /> Agent Token Usage</p>
          <p className="text-[10px] text-white/25">Usage, input and output cover {activeLabel} · limit and tokens left belong to each assignment</p>
        </div>

        {singleAgentUsage.length === 0 && teamUsage.length === 0 && membershipUsage.length === 0 ? (
          <span className="text-xs text-white/35">No token usage records found for this user.</span>
        ) : (
          <div className="space-y-6">
            {/* ── Single agents: one allowance per agent ── */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-300/70">
                <Bot size={11} /> Single Agents
                <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300/60">{singleAgentUsage.length}</span>
              </p>
              {singleAgentUsage.length === 0 ? (
                <span className="text-xs text-white/30">No directly assigned agents</span>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
                        <th className="pb-2 font-medium">Agent Name</th>
                        <th className="pb-2 font-medium">Total Limit</th>
                        <th className="pb-2 font-medium">Usage</th>
                        <th className="pb-2 font-medium">Tokens Left</th>
                        <th className="pb-2 font-medium">Input</th>
                        <th className="pb-2 font-medium">Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleAgentUsage.map((agent) => {
                        const percent = agent.limit > 0 ? Math.min(100, (agent.used / agent.limit) * 100) : 0;
                        const isEditing = editingTokenLimit?.agentName === agent.name;

                        return (
                          <tr key={agent.assignmentId ?? agent.name} className="border-b border-white/5 last:border-0">
                            <td className="py-3">
                              <span className="inline-flex items-center gap-2 font-semibold text-sky-300">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                                {agent.name}
                              </span>
                            </td>
                            <td className="py-3">
                              {isEditing ? (
                                <form
                                  className="flex items-center gap-1.5"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void saveTokenLimit();
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    autoFocus
                                    aria-label={`Token limit for ${agent.name}`}
                                    value={editingTokenLimit.value}
                                    onChange={(event) =>
                                      setEditingTokenLimit((current) =>
                                        current ? { ...current, value: event.target.value } : current,
                                      )
                                    }
                                    disabled={savingTokenLimit}
                                    className="w-28 rounded-md border border-sky-400/40 bg-slate-950 px-2 py-1 font-mono text-xs text-white outline-none focus:border-sky-400 disabled:opacity-50"
                                  />
                                  <button
                                    type="submit"
                                    disabled={savingTokenLimit}
                                    aria-label={`Save token limit for ${agent.name}`}
                                    title="Save token limit"
                                    className="rounded-md p-1.5 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                                  >
                                    {savingTokenLimit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingTokenLimit}
                                    onClick={() => {
                                      setEditingTokenLimit(null);
                                      setTokenLimitError(null);
                                    }}
                                    aria-label="Cancel token limit edit"
                                    title="Cancel"
                                    className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                  >
                                    <X size={13} />
                                  </button>
                                </form>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-white/80">{agent.limit.toLocaleString()}</span>
                                  {agent.assignmentId && (
                                    <button
                                      type="button"
                                      onClick={() => beginTokenLimitEdit(agent.name, agent.limit)}
                                      aria-label={`Edit token limit for ${agent.name}`}
                                      title="Edit direct-agent token limit"
                                      className="rounded-md p-1 text-white/30 transition hover:bg-sky-500/15 hover:text-sky-300"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <span className="min-w-[90px] font-mono text-white">{agent.used.toLocaleString()}</span>
                                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/5">
                                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="text-[11px] text-white/35">{percent.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="font-mono text-emerald-300">{agent.left.toLocaleString()}</span>
                              {agent.limit > 0 && (
                                <span className="ml-2 text-[10px] text-white/30">{agent.grantUsed.toLocaleString()} used on this grant</span>
                              )}
                            </td>
                            <td className="py-3 font-mono text-white/60">{agent.input.toLocaleString()}</td>
                            <td className="py-3 font-mono text-white/60">{agent.output.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Teams: the team limit is applied to EACH agent, tracked per agent ── */}
            <GroupUsageBlock
              icon={<Users size={11} />}
              label="Teams"
              accent="violet"
              emptyText="No active team assignment"
              limitLabel="Limit"
              sections={teamUsage}
              activeLabel={activeLabel}
              renderGrantUsedCell={(section, agent) => {
                const grantUsed = agent.grantUsed ?? 0;
                const isEditing =
                  editingTeamUsage?.teamId === section.teamId && editingTeamUsage?.agentName === agent.name;

                if (isEditing) {
                  return (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveTeamUsage();
                      }}
                    >
                      <input
                        type="number"
                        step={1}
                        autoFocus
                        placeholder="Input"
                        aria-label={`Input tokens for ${agent.name} in ${section.name}`}
                        value={editingTeamUsage.inputTokens}
                        onChange={(event) =>
                          setEditingTeamUsage((current) =>
                            current ? { ...current, inputTokens: event.target.value } : current,
                          )
                        }
                        disabled={savingTeamUsage}
                        className="w-20 rounded-md border border-violet-400/40 bg-slate-950 px-2 py-1 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-400 disabled:opacity-50"
                      />
                      <input
                        type="number"
                        step={1}
                        placeholder="Output"
                        aria-label={`Output tokens for ${agent.name} in ${section.name}`}
                        value={editingTeamUsage.outputTokens}
                        onChange={(event) =>
                          setEditingTeamUsage((current) =>
                            current ? { ...current, outputTokens: event.target.value } : current,
                          )
                        }
                        disabled={savingTeamUsage}
                        className="w-20 rounded-md border border-violet-400/40 bg-slate-950 px-2 py-1 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-400 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={savingTeamUsage}
                        aria-label={`Record usage for ${agent.name} in ${section.name}`}
                        title="Record usage (negative values refund)"
                        className="rounded-md p-1.5 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {savingTeamUsage ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        type="button"
                        disabled={savingTeamUsage}
                        onClick={() => {
                          setEditingTeamUsage(null);
                          setTeamUsageError(null);
                        }}
                        aria-label="Cancel usage entry"
                        title="Cancel"
                        className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                      >
                        <X size={13} />
                      </button>
                    </form>
                  );
                }

                return (
                  <div className="flex items-center gap-2">
                    <span>{grantUsed.toLocaleString()}</span>
                    {section.teamId && (
                      <button
                        type="button"
                        onClick={() => beginTeamUsageEdit(section, agent.name)}
                        aria-label={`Record token usage for ${agent.name} in ${section.name}`}
                        title="Record input/output tokens on this team grant"
                        className="rounded-md p-1 text-white/30 transition hover:bg-violet-500/15 hover:text-violet-300"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                );
              }}
            />

            {/* ── Memberships: ONE monthly pool shared by all the plan's agents.
                Used / left come from the grant's stored rollup, which every
                covered agent's chat moves; the agent rows only split the
                selected range's usage between them. ── */}
            <GroupUsageBlock
              icon={<CreditCard size={11} />}
              label="Memberships"
              accent="emerald"
              emptyText="No active membership"
              limitLabel="Monthly pool"
              sections={membershipUsage}
              activeLabel={activeLabel}
            />
          </div>
        )}
        {tokenLimitError && <p className="mt-3 text-xs text-red-400">{tokenLimitError}</p>}
        {teamUsageError && <p className="mt-3 text-xs text-red-400">{teamUsageError}</p>}
      </div>

      {/* ──────── ANALYTICS SECTION HEADER ──────── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-sky-400" />
          <h2 className="text-lg font-bold">Usage Analytics</h2>
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-white/50">{activeLabel}</span>
        </div>
      </div>

      {/* ──────── ROW 1: Daily Area Chart (same style as Assignments page) ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h3 className="font-semibold flex items-center gap-2 text-base">
            <Activity size={18} className="text-emerald-400" />
            {currency === "tokens" ? "Token Usage by Days (All Agents)" : `Cost by Days — ${currency === "USD" ? "$ USD" : "€ EUR"} (All Agents)`}
          </h3>
          {agentSelector}
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {/* Stacked bars, not smoothed areas: each day is a discrete ledger
                row, and a curve would spread one day's spend onto its neighbours. */}
            <ComposedChart data={displayDailyUsageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval="preserveStartEnd" minTickGap={16} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip cursor={{ fill: "#ffffff08" }} content={(props) => <SortedTooltip {...props} currency={currency} />} />
              {visibleUsageSeries.map((agent) => (
                <Bar
                  key={agent.name}
                  stackId="usage"
                  dataKey={agent.name}
                  fill={agent.color}
                  fillOpacity={0.85}
                  maxBarSize={28}
                />
              ))}

              <Line
                type="monotone"
                dataKey="stops"
                stroke="none"
                dot={(props: unknown) => {
                  const { cx, payload } = props as StopDotProps;
                  if (cx !== undefined && payload?.stops && payload.stops > 0) {
                    return (
                      <g key={`stop-${payload.date}`}>
                        <circle cx={cx} cy={20} r={8} fill="#ef444440" />
                        <circle cx={cx} cy={20} r={5} fill="#ef4444" />
                        <text x={cx} y={24} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>{payload.stops}</text>
                      </g>
                    );
                  }
                  return <g key={`no-stop-${payload?.date ?? 'unknown'}`} />;
                }}
                yAxisId={1}
              />
              <YAxis yAxisId={1} hide domain={[0, 10]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ──────── ROW 2: Weekly Area Chart ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h3 className="font-semibold flex items-center gap-2 text-base">
            <Calendar size={18} className="text-emerald-400" />
            {currency === "tokens" ? "Token Usage by Weeks (All Agents)" : `Cost by Weeks — ${currency === "USD" ? "$ USD" : "€ EUR"} (All Agents)`}
          </h3>
          {agentSelector}
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayWeeklyUsageData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={12} tickMargin={10} />
              <YAxis stroke="#ffffff40" fontSize={12} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip cursor={{ fill: "#ffffff08" }} content={(props) => <SortedTooltip {...props} currency={currency} />} />
              {visibleUsageSeries.map((agent) => (
                <Bar
                  key={agent.name}
                  stackId="usage"
                  dataKey={agent.name}
                  fill={agent.color}
                  fillOpacity={0.85}
                  maxBarSize={72}
                />
              ))}

              <Line
                type="monotone"
                dataKey="stops"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={(props: unknown) => {
                  const { cx, cy, payload } = props as StopDotProps;
                  if (cx !== undefined && cy !== undefined && payload?.stops && payload.stops > 0) {
                    return (
                      <g key={`ws-${payload.week}`}>
                        <circle cx={cx} cy={cy} r={10} fill="#ef444420" />
                        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#0f172a" strokeWidth={2} />
                        <text x={cx} y={cy + 3.5} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>{payload.stops}</text>
                      </g>
                    );
                  }
                  return <g key={`wns-${payload?.week ?? 'unknown'}`} />;
                }}
                yAxisId={1}
              />
              <YAxis yAxisId={1} hide domain={[0, 10]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ──────── ROW 3: Agent Breakdown Donut ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <h3 className="font-semibold flex items-center gap-2 text-sm mb-5">
          <Bot size={16} className="text-indigo-400" /> Total Usage by Agent
        </h3>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="h-[220px] w-full max-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tokenUsageChartData.length ? tokenUsageChartData : MOCK_AGENT_USAGE} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {(tokenUsageChartData.length ? tokenUsageChartData : MOCK_AGENT_USAGE).map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                  formatter={(value) => [formatChartValue(Number(value), currency), ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 flex-1">
            {(tokenUsageChartData.length ? tokenUsageChartData : MOCK_AGENT_USAGE).map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-white/70">{a.name}</span>
                </div>
                <span className="font-mono text-white/90">{formatChartValue(a.value, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ──────── STOPS SUMMARY CARD ──────── */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
        <h3 className="font-semibold flex items-center gap-2 text-sm mb-4">
          <OctagonAlert size={16} className="text-red-400" /> Overusage / Quota Stops Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-red-500/10 p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{stopCount}</p>
            <p className="text-[11px] text-red-400/60 mt-1 uppercase tracking-wider">Total Stops Applied</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{MOCK_DAILY_USAGE.filter((d) => d.stops > 0).length}</p>
            <p className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">Days With Stops</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-3xl font-bold text-white/80">
              {(MOCK_DAILY_USAGE.filter((d) => d.stops > 0).length / MOCK_DAILY_USAGE.length * 100).toFixed(0)}%
            </p>
            <p className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">Stop Rate (Days)</p>
          </div>
        </div>
      </div>

      {/* ──────── REMOVE CONFIRMATION ──────── */}
      {pendingRemoval && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => { if (!removing) setPendingRemoval(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-agent-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1221] p-6 shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h2 id="remove-agent-title" className="text-base font-semibold text-white">
                  {REMOVAL_COPY[pendingRemoval.kind].title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                  <span className="font-medium text-sky-400">{pendingRemoval.name}</span> will no longer be available to{" "}
                  <span className="font-medium text-white/70">{displayEmail}</span>. {REMOVAL_COPY[pendingRemoval.kind].note}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={Boolean(removing)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoval}
                disabled={Boolean(removing)}
                className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-400 ring-1 ring-red-500/30 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? <><Loader2 size={13} className="animate-spin" /> Removing...</> : <><X size={13} /> {REMOVAL_COPY[pendingRemoval.kind].action}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
