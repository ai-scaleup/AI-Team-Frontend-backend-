"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, User as UserIcon, Calendar, Activity, CreditCard,
  Bot, Clock, ChevronDown, OctagonAlert, Shield, Mail, Hash,
  DollarSign, Euro
} from "lucide-react";
import {
  Area, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart
} from "recharts";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const SONNET_4_6_INPUT_USD_PER_TOKEN = 3 / 1000000;
const SONNET_4_6_OUTPUT_USD_PER_TOKEN = 15 / 1000000;
const EUR_RATE = 0.92;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ai-team-server.onrender.com";

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

const formatTokensAsCost = (
  tokens: number,
  currency: CurrencyMode,
  inputTokens?: number,
  outputTokens?: number,
): string => {
  if (tokens === 0) return "0";
  if (currency === "tokens") {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  if (inputTokens === undefined || outputTokens === undefined) return "—";
  const usd = getClaudeSonnet46Usd(inputTokens, outputTokens);
  if (currency === "EUR") {
    const eur = usd * EUR_RATE;
    if (eur >= 1000) return `€${(eur / 1000).toFixed(1)}k`;
    if (eur >= 1) return `€${eur.toFixed(2)}`;
    return `€${eur.toFixed(3)}`;
  }
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
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

const SortedTooltip = ({
  active, payload, label, currency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name: string; value: number; color: string }>;
  label?: string;
  currency: CurrencyMode;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div style={{ backgroundColor: "#0f172a", border: "1px solid #ffffff15", borderRadius: "10px", padding: "10px 14px", fontSize: "12px" }}>
      <p style={{ color: "#ffffff80", marginBottom: 6 }}>{label}</p>
      {sorted.map((entry) => (
        <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", gap: 20, color: "#fff", marginBottom: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: entry.color, display: "inline-block", flexShrink: 0 }} />
            {entry.name}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatChartValue(Number(entry.value), currency)}</span>
        </div>
      ))}
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
  agentName?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  durationDays?: number | null;
  monthlyTokenLimit?: number | null;
  isActive?: boolean;
};

type ApiGroupAssignment = Omit<ApiAssignment, "agentName"> & {
  group?: {
    name?: string | null;
    items?: { agentName?: string }[];
  } | null;
};

type ApiMembershipAssignment = {
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  template?: {
    name?: string | null;
    durationDays?: number | null;
    monthlyTokenLimit?: number | null;
    includedAgents?: string[] | null;
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
    memberships?: ApiMembershipAssignment[];
    tokenUsage?: ApiTokenUsage[];
    stopLogs?: unknown[];
  };
  dailyUsage?: ApiDailyUsage[];
};

type DisplaySubscription = {
  plan: string;
  duration: number;
  startsAt: string;
  expiration: string;
  monthlyLimit: number;
  usedThisCycle: number;
  usedThisCycleInput: number;
  usedThisCycleOutput: number;
  status: "Active" | "Expired";
  agents: string[];
};

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
  const activeAgents = (details?.user.agents ?? []).filter(isActiveAssignment);
  const assignedAgents = new Set<string>();

  activeAgents.forEach((agent) => agent.agentName && assignedAgents.add(agent.agentName));
  activeGroups.forEach((assignment) => {
    assignment.group?.items?.forEach((item) => item.agentName && assignedAgents.add(item.agentName));
  });
  activeMemberships.forEach((assignment) => {
    assignment.template?.includedAgents?.forEach((agentName) => assignedAgents.add(agentName));
  });

  return Array.from(assignedAgents);
};

const buildSubscription = (details: ApiUserDetails | null): DisplaySubscription => {
  const activeMemberships = (details?.user.memberships ?? []).filter(isActiveAssignment);
  const activeGroups = (details?.user.groups ?? []).filter(isActiveAssignment);
  const activeAgents = (details?.user.agents ?? []).filter(isActiveAssignment);
  const primaryMembership = activeMemberships[0];
  const primaryGroup = activeGroups[0];
  const primaryAgent = activeAgents[0];
  const assignedAgents = collectAssignedAgentNames(details);

  const legacyTokenLimit = (details?.user.tokenUsage ?? []).reduce(
    (sum, item) => sum + (item.totalTokenLimit ?? 0),
    0,
  );
  const legacyTokenUsage = (details?.user.tokenUsage ?? []).reduce(
    (sum, item) => sum + (item.totalUsedTokens ?? 0),
    0,
  );
  const usedThisCycle = Array.isArray(details?.dailyUsage)
    ? details.dailyUsage.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0)
    : legacyTokenUsage;
  const usedThisCycleInput = Array.isArray(details?.dailyUsage)
    ? details.dailyUsage.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0)
    : (details?.user.tokenUsage ?? []).reduce((sum, item) => sum + (item.totalUsedInputTokens ?? 0), 0);
  const usedThisCycleOutput = Array.isArray(details?.dailyUsage)
    ? details.dailyUsage.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0)
    : (details?.user.tokenUsage ?? []).reduce((sum, item) => sum + (item.totalUsedOutputTokens ?? 0), 0);

  const assignmentMonthlyLimit =
    primaryMembership?.template?.monthlyTokenLimit ||
    primaryGroup?.monthlyTokenLimit ||
    primaryAgent?.monthlyTokenLimit ||
    0;

  return {
    plan:
      primaryMembership?.template?.name ??
      primaryGroup?.group?.name ??
      (activeAgents.length > 0
        ? activeAgents.map((agent) => agent.agentName).filter(Boolean).join(" & ")
        : "No active plan"),
    duration:
      primaryMembership?.template?.durationDays ??
      primaryGroup?.durationDays ??
      primaryAgent?.durationDays ??
      0,
    startsAt: formatDate(primaryMembership?.startsAt ?? primaryGroup?.startsAt ?? primaryAgent?.startsAt),
    expiration: formatDate(primaryMembership?.expiresAt ?? primaryGroup?.expiresAt ?? primaryAgent?.expiresAt),
    monthlyLimit: assignmentMonthlyLimit || legacyTokenLimit,
    usedThisCycle,
    usedThisCycleInput,
    usedThisCycleOutput,
    status: primaryMembership || primaryGroup || primaryAgent ? "Active" : "Expired",
    agents: assignedAgents,
  };
};

const TOKEN_USAGE_COLORS = [
  "#38bdf8",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#60a5fa",
  "#f97316",
  "#22d3ee",
  "#c084fc",
];

type AgentTokenUsageRow = {
  name: string;
  limit: number;
  used: number;
  left: number;
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

  const tokenRows = rows
    .map((item, index) => {
      const limit = item.totalTokenLimit ?? 0;
      const cumulativeUsed = item.totalUsedTokens ?? 0;
      const name = item.agentName ?? "UNKNOWN_AGENT";
      const used = hasDailyUsagePayload ? dailyUsedByAgent.get(name) ?? 0 : cumulativeUsed;
      const left = item.totalTokensLeft ?? Math.max(0, limit - cumulativeUsed);
      seenAgents.add(name);

      return {
        name,
        limit,
        used,
        left,
        input: hasDailyUsagePayload ? dailyInputByAgent.get(name) ?? 0 : item.totalUsedInputTokens ?? 0,
        output: hasDailyUsagePayload ? dailyOutputByAgent.get(name) ?? 0 : item.totalUsedOutputTokens ?? 0,
        color: TOKEN_USAGE_COLORS[index % TOKEN_USAGE_COLORS.length],
      };
    })
    .filter((item) => item.name !== "UNKNOWN_AGENT" || item.limit > 0 || item.used > 0);

  assignedAgents.forEach((name) => {
    if (!seenAgents.has(name)) {
      tokenRows.push({
        name,
        limit: 0,
        used: 0,
        left: 0,
        input: 0,
        output: 0,
        color: TOKEN_USAGE_COLORS[tokenRows.length % TOKEN_USAGE_COLORS.length],
      });
    }
  });

  dailyUsedByAgent.forEach((used, name) => {
    if (!seenAgents.has(name)) {
      tokenRows.push({
        name,
        limit: 0,
        used,
        left: 0,
        input: dailyInputByAgent.get(name) ?? 0,
        output: dailyOutputByAgent.get(name) ?? 0,
        color: TOKEN_USAGE_COLORS[tokenRows.length % TOKEN_USAGE_COLORS.length],
      });
    }
  });

  return tokenRows.sort((a, b) => b.used - a.used);
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

  (details?.dailyUsage ?? []).forEach((item) => {
    if (item.agentName) {
      agentNames.add(item.agentName);
    }
  });

  return Array.from(agentNames).map((name, index) => ({
    name,
    color:
      agentTokenUsage.find((agent) => agent.name === name)?.color ??
      TOKEN_USAGE_COLORS[index % TOKEN_USAGE_COLORS.length],
  }));
};

const buildDailyUsageData = (
  details: ApiUserDetails | null,
  series: AgentUsageSeries[],
  agentTokenUsage: AgentTokenUsageRow[],
  usageRange?: UsageDateRange,
): DailyUsagePoint[] => {
  const seriesNames = new Set(series.map((item) => item.name));
  const rows = (details?.dailyUsage ?? []).filter(
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

  dailyUsage.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
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

        const response = await fetch(`${API_BASE}/admin/dashboard/users/${resolvedParams.id}?${query.toString()}`, {
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
  }, [resolvedParams.id, usageRange]);

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

  const subscription = useMemo(() => buildSubscription(details), [details]);
  const agentTokenUsage = useMemo(() => buildAgentTokenUsage(details), [details]);
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
  const tokenUsageChartData = agentTokenUsage.map((agent) => ({
    name: agent.name,
    value:
      currency === "tokens"
        ? agent.used
        : getClaudeSonnet46Usd(agent.input, agent.output) * (currency === "EUR" ? EUR_RATE : 1),
    color: agent.color,
  }));

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
  const usagePercent = subscription.monthlyLimit > 0
    ? (subscription.usedThisCycle / subscription.monthlyLimit) * 100
    : 0;
  const expiryTime = new Date(subscription.expiration).getTime();
  const daysRemaining = Number.isNaN(expiryTime)
    ? 0
    : Math.max(0, Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)));
  const stopCount = details?.user.stopLogs?.length ?? totalStops;

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

        {/* ──────── TIMEFRAME SELECTOR ──────── */}
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

      {/* ──────── SUBSCRIPTION DETAILS ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Plan */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5 flex items-center gap-1"><CreditCard size={11} /> Active Plan</p>
          <p className="font-semibold text-sm leading-snug">{subscription.plan}</p>
          <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            subscription.status === "Active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            {subscription.status}
          </span>
        </div>

        {/* Duration */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5 flex items-center gap-1"><Clock size={11} /> Duration</p>
          <p className="font-semibold text-sm">{subscription.duration} days</p>
          <p className="text-[11px] text-white/40 mt-1">{subscription.startsAt} → {subscription.expiration}</p>
        </div>

        {/* Expiration */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5 flex items-center gap-1"><Calendar size={11} /> Expiration</p>
          <p className="font-semibold text-sm">{subscription.expiration}</p>
          <p className="text-[11px] text-amber-400/70 mt-1">{daysRemaining} days remaining</p>
        </div>

        {/* Monthly limit */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">Monthly Limit</p>
          <p className="font-mono text-lg text-sky-400">
            {formatTokensAsCost(subscription.monthlyLimit, currency)}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
          </div>
        </div>

        {/* Used this cycle */}
        <div className={`rounded-xl border p-4 ${usagePercent >= 90 ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
          <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${usagePercent >= 90 ? "text-red-400/60" : "text-white/35"}`}>Used This Cycle</p>
          <p className={`font-mono text-lg ${usagePercent >= 90 ? "text-red-400" : "text-white"}`}>
            {formatTokensAsCost(
              subscription.usedThisCycle,
              currency,
              subscription.usedThisCycleInput,
              subscription.usedThisCycleOutput,
            )}
          </p>
          <p className={`text-[10px] mt-1 uppercase tracking-wider ${usagePercent >= 90 ? "text-red-400/50" : "text-white/30"}`}>
            {usagePercent.toFixed(1)}% used · {stopCount} stops
          </p>
        </div>
      </div>

      {/* ──────── ASSIGNED AGENTS CHIPS ──────── */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1"><Shield size={11} /> Assigned Agents</p>
        <div className="flex flex-wrap gap-2">
          {subscription.agents.length > 0 ? subscription.agents.map((a) => (
            <span key={a} className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 ring-1 ring-sky-500/20">
              <Bot size={13} /> {a}
            </span>
          )) : <span className="text-xs text-white/35">No assigned agents</span>}
        </div>
      </div>

      {/* Agent token usage from backend records */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1"><Bot size={11} /> Agent Token Usage</p>
        {agentTokenUsage.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
                  <th className="pb-3 font-medium">Agent Name</th>
                  <th className="pb-3 font-medium">Total Limit</th>
                  <th className="pb-3 font-medium">Total Usage</th>
                  <th className="pb-3 font-medium">Tokens Left</th>
                  <th className="pb-3 font-medium">Input</th>
                  <th className="pb-3 font-medium">Output</th>
                </tr>
              </thead>
              <tbody>
                {agentTokenUsage.map((agent) => {
                  const percent = agent.limit > 0 ? Math.min(100, (agent.used / agent.limit) * 100) : 0;

                  return (
                    <tr key={agent.name} className="border-b border-white/5 last:border-0">
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-sky-300">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                          {agent.name}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-white/80">{agent.limit.toLocaleString()}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="min-w-[90px] font-mono text-white">{agent.used.toLocaleString()}</span>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="text-[11px] text-white/35">{percent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-emerald-300">{agent.left.toLocaleString()}</td>
                      <td className="py-3 font-mono text-white/60">{agent.input.toLocaleString()}</td>
                      <td className="py-3 font-mono text-white/60">{agent.output.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <span className="text-xs text-white/35">No token usage records found for this user.</span>
        )}
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
            <ComposedChart data={displayDailyUsageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {visibleUsageSeries.map((agent, index) => (
                  <linearGradient key={agent.name} id={`gradDay${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={agent.color} stopOpacity={0.75} />
                    <stop offset="95%" stopColor={agent.color} stopOpacity={0.25} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval={2} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip content={(props) => <SortedTooltip {...props} currency={currency} />} />
              {visibleUsageSeries.map((agent, index) => (
                <Area
                  key={agent.name}
                  type="monotone"
                  dataKey={agent.name}
                  stackId="1"
                  stroke={agent.color}
                  strokeWidth={1.5}
                  fill={`url(#gradDay${index})`}
                  dot={false}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={12} tickMargin={10} />
              <YAxis stroke="#ffffff40" fontSize={12} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip content={(props) => <SortedTooltip {...props} currency={currency} />} />
              <defs>
                {visibleUsageSeries.map((agent, index) => (
                  <linearGradient key={agent.name} id={`gradWeek${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={agent.color} stopOpacity={0.75} />
                    <stop offset="95%" stopColor={agent.color} stopOpacity={0.25} />
                  </linearGradient>
                ))}
              </defs>
              {visibleUsageSeries.map((agent, index) => (
                <Area
                  key={agent.name}
                  type="monotone"
                  dataKey={agent.name}
                  stackId="1"
                  stroke={agent.color}
                  strokeWidth={1.5}
                  fill={`url(#gradWeek${index})`}
                  dot={false}
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
    </div>
  );
}
