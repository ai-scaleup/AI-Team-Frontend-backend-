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
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from "recharts";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const USD_PER_TOKEN = 0.00003;
const EUR_RATE = 0.92;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ai-team-server.onrender.com";

type CurrencyMode = "tokens" | "USD" | "EUR";

const formatTokensAsCost = (tokens: number, currency: CurrencyMode): string => {
  if (tokens === 0) return "0";
  if (currency === "tokens") {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  const usd = tokens * USD_PER_TOKEN;
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
  const usd = value * USD_PER_TOKEN;
  if (currency === "EUR") {
    const eur = usd * EUR_RATE;
    if (eur >= 1) return `€${eur.toFixed(1)}`;
    return `€${eur.toFixed(2)}`;
  }
  if (usd >= 1) return `$${usd.toFixed(1)}`;
  return `$${usd.toFixed(2)}`;
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

const buildSubscription = (details: ApiUserDetails | null): DisplaySubscription => {
  const activeMemberships = (details?.user.memberships ?? []).filter(isActiveAssignment);
  const activeGroups = (details?.user.groups ?? []).filter(isActiveAssignment);
  const activeAgents = (details?.user.agents ?? []).filter(isActiveAssignment);
  const primaryMembership = activeMemberships[0];
  const primaryGroup = activeGroups[0];
  const primaryAgent = activeAgents[0];

  const assignedAgents = new Set<string>();
  activeAgents.forEach((agent) => agent.agentName && assignedAgents.add(agent.agentName));
  activeGroups.forEach((assignment) => {
    assignment.group?.items?.forEach((item) => item.agentName && assignedAgents.add(item.agentName));
  });
  activeMemberships.forEach((assignment) => {
    assignment.template?.includedAgents?.forEach((agentName) => assignedAgents.add(agentName));
  });

  const usedThisCycle = (details?.dailyUsage ?? []).reduce(
    (sum, item) => sum + (item.totalTokens ?? 0),
    0,
  );
  const legacyTokenLimit = (details?.user.tokenUsage ?? []).reduce(
    (sum, item) => sum + (item.totalTokenLimit ?? 0),
    0,
  );
  const legacyTokenUsage = (details?.user.tokenUsage ?? []).reduce(
    (sum, item) => sum + (item.totalUsedTokens ?? 0),
    0,
  );

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
    usedThisCycle:
      usedThisCycle ||
      legacyTokenUsage,
    status: primaryMembership || primaryGroup || primaryAgent ? "Active" : "Expired",
    agents: Array.from(assignedAgents),
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

  return rows
    .map((item, index) => {
      const limit = item.totalTokenLimit ?? 0;
      const used = item.totalUsedTokens ?? 0;
      const left = item.totalTokensLeft ?? Math.max(0, limit - used);

      return {
        name: item.agentName ?? "UNKNOWN_AGENT",
        limit,
        used,
        left,
        input: item.totalUsedInputTokens ?? 0,
        output: item.totalUsedOutputTokens ?? 0,
        color: TOKEN_USAGE_COLORS[index % TOKEN_USAGE_COLORS.length],
      };
    })
    .filter((item) => item.limit > 0 || item.used > 0)
    .sort((a, b) => b.used - a.used);
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
  const agentNames = new Set<string>();

  agentTokenUsage.forEach((agent) => {
    if (agent.used > 0) agentNames.add(agent.name);
  });

  (details?.dailyUsage ?? []).forEach((item) => {
    if (item.agentName && (item.totalTokens ?? 0) > 0) {
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
): DailyUsagePoint[] => {
  const seriesNames = new Set(series.map((item) => item.name));
  const rows = (details?.dailyUsage ?? []).filter(
    (item) => item.agentName && seriesNames.has(item.agentName),
  );

  if (!rows.length) {
    if (!series.length) return MOCK_DAILY_USAGE;

    const totalPoint: DailyUsagePoint = { date: "Total", total: 0, stops: 0 };
    series.forEach((agent) => {
      const used = agentTokenUsage.find((item) => item.name === agent.name)?.used ?? 0;
      totalPoint[agent.name] = used;
      totalPoint.total = Number(totalPoint.total) + used;
    });

    return [totalPoint];
  }

  const grouped = new Map<string, DailyUsagePoint>();

  rows.forEach((item) => {
    if (!item.date || !item.agentName) return;

    const dateKey = item.date.slice(0, 10);
    const tokens = item.totalTokens ?? 0;
    const current = grouped.get(dateKey) ?? {
      date: formatUsageDate(item.date),
      total: 0,
      stops: 0,
    };

    current[item.agentName] = Number(current[item.agentName] ?? 0) + tokens;
    current.total = Number(current.total) + tokens;
    grouped.set(dateKey, current);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
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
    });
    current.total = Number(current.total) + Number(day.total ?? 0);
    current.stops = Number(current.stops) + Number(day.stops ?? 0);
    grouped.set(weekIndex, current);
  });

  return Array.from(grouped.values());
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
export default function SingleUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  const [selectedPreset, setSelectedPreset] = useState("this_month");
  const [customDays, setCustomDays] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [currency, setCurrency] = useState<CurrencyMode>("tokens");
  const [details, setDetails] = useState<ApiUserDetails | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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
        const response = await fetch(`${API_BASE}/admin/dashboard/users/${resolvedParams.id}?days=30`, {
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
  }, [resolvedParams.id]);

  const activeLabel = (() => {
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    if (customDays) return `Last ${customDays} days`;
    return PRESETS.find((p) => p.value === selectedPreset)?.label ?? "This Month";
  })();

  const handlePreset = (value: string) => {
    setSelectedPreset(value);
    setCustomDays("");
    setCustomFrom("");
    setCustomTo("");
    setShowPicker(false);
  };

  const handleCustomDays = () => {
    if (customDays) { setSelectedPreset(""); setCustomFrom(""); setCustomTo(""); setShowPicker(false); }
  };

  const handleCustomRange = () => {
    if (customFrom && customTo) { setSelectedPreset(""); setCustomDays(""); setShowPicker(false); }
  };

  const subscription = useMemo(() => buildSubscription(details), [details]);
  const agentTokenUsage = useMemo(() => buildAgentTokenUsage(details), [details]);
  const usageSeries = useMemo(
    () => buildUsedAgentSeries(details, agentTokenUsage),
    [details, agentTokenUsage],
  );
  const dailyUsageData = useMemo(
    () => buildDailyUsageData(details, usageSeries, agentTokenUsage),
    [details, usageSeries, agentTokenUsage],
  );
  const weeklyUsageData = useMemo(
    () => buildWeeklyUsageData(dailyUsageData, usageSeries),
    [dailyUsageData, usageSeries],
  );
  const tokenUsageChartData = agentTokenUsage.map((agent) => ({
    name: agent.name,
    value: agent.used,
    color: agent.color,
  }));
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
                      selectedPreset === p.value && !customDays && !customFrom
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
            {formatTokensAsCost(subscription.usedThisCycle, currency)}
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
        {/* Currency Toggle */}
        <CurrencyToggle currency={currency} onChange={setCurrency} />
      </div>

      {/* ──────── ROW 1: Daily Area Chart (same style as Assignments page) ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Activity size={16} className="text-sky-400" />
            {currency === "tokens" ? "Token Usage by Days" : `Cost by Days — ${currency === "USD" ? "$ USD" : "€ EUR"}`}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/50">
            {usageSeries.map((agent) => (
              <span key={agent.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color }} />
                {agent.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Stops</span>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyUsageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {usageSeries.map((agent, index) => (
                  <linearGradient key={agent.name} id={`gradDay${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={agent.color} stopOpacity={0.75} />
                    <stop offset="95%" stopColor={agent.color} stopOpacity={0.25} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval={2} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value, name) => [formatTokensAsCost(Number(value), currency), String(name)]}
                labelStyle={{ color: "#ffffff80" }}
              />
              {usageSeries.map((agent, index) => (
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
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-emerald-400" />
            {currency === "tokens" ? "Token Usage by Weeks" : `Cost by Weeks — ${currency === "USD" ? "$ USD" : "€ EUR"}`}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/50">
            {usageSeries.map((agent) => (
              <span key={agent.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color }} />
                {agent.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><OctagonAlert size={11} className="text-red-400" /> Stops</span>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeklyUsageData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={12} tickMargin={10} />
              <YAxis stroke="#ffffff40" fontSize={12} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                cursor={{ fill: "#ffffff05" }}
                formatter={(value, name) => [formatTokensAsCost(Number(value), currency), String(name)]}
              />
              <Legend iconType="circle" />
              <defs>
                {usageSeries.map((agent, index) => (
                  <linearGradient key={agent.name} id={`gradWeek${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={agent.color} stopOpacity={0.75} />
                    <stop offset="95%" stopColor={agent.color} stopOpacity={0.25} />
                  </linearGradient>
                ))}
              </defs>
              {usageSeries.map((agent, index) => (
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
                  formatter={(value) => [formatTokensAsCost(Number(value), currency), ""]}
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
                <span className="font-mono text-white/90">{formatTokensAsCost(a.value, currency)}</span>
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
