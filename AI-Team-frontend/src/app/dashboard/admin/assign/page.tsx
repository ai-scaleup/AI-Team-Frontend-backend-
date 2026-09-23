"use client";

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  UserPlus, Calendar, CreditCard, Activity, TrendingUp, Search,
  Bot, Users, Clock,
  DollarSign, Euro, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

/* ──────────────────────────── MOCK DATA ──────────────────────────── */

const ALL_AGENTS = [
  "SARA_AI", "JENNIFER_AI", "CHIARA_AI", "FREAP_CHIARA", "FREAP_JENNIFER", "PEARL_ADMIN", "CHIARA_VANESSA", "JIM", "ALEX", "MIKE", "TONY",
  "LARA", "VALENTINA", "DANIELE", "SIMONE", "NIKO", "ALADINO", "LAURA", "DAN",
  "MAX", "SOFIA", "ROBERTA", "TEST_JIM", "TEST_ALEX", "TEST_MIKE", "TEST_TONY",
  "TEST_LARA", "TEST_VALENTINA", "TEST_DANIELE", "TEST_SIMONE", "TEST_NIKO",
  "TEST_ALADINO", "TEST_LAURA", "TEST_DAN", "TEST_MAX", "TEST_SOFIA",
  "TEST_ROBERTA", "TEST_SARA_AI", "TEST_JENNIFER_AI", "TEST_CHIARA_AI",
];

const DEFAULT_VISIBLE_AGENTS = ALL_AGENTS;

// Keep agent colors stable even when the API returns agents in a different order.
const AGENT_COLORS: Record<string, string> = {
  SARA_AI: "#06b6d4", JENNIFER_AI: "#e879f9", CHIARA_AI: "#f472b6", FREAP_CHIARA: "#10b981", FREAP_JENNIFER: "#818cf8", PEARL_ADMIN: "#22d3ee", CHIARA_VANESSA: "#f9a8d4",
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

const COLOR_PALETTE = [
  "#38bdf8",  // sky blue   (~200°)
  "#f87171",  // red        (~0°)
  "#4ade80",  // green      (~142°)
  "#fbbf24",  // amber      (~45°)
  "#a855f7",  // violet     (~270°)
  "#fb923c",  // orange     (~25°)
  "#2dd4bf",  // teal       (~175°)
  "#f472b6",  // pink       (~322°)
  "#34d399",  // emerald    (~160°)
  "#a3e635",  // lime       (~80°)
];

const getAgentColor = (agent: string, index = 0) =>
  AGENT_COLORS[agent] ?? COLOR_PALETTE[index % COLOR_PALETTE.length];

/* ──────────────── CURRENCY HELPERS ──────────────── */

const SONNET_4_6_INPUT_USD_PER_TOKEN = 3 / 1000000;
const SONNET_4_6_OUTPUT_USD_PER_TOKEN = 15 / 1000000;
const EUR_RATE = 0.92; // 1 USD = 0.92 EUR

type CurrencyMode = "tokens" | "USD" | "EUR";

type AgentTeam = {
  id: string;
  name: string;
  agents: string[];
};

type AgentGroupListItem = {
  id: string;
  name: string;
};

type AgentGroupListResponse = {
  data?: AgentGroupListItem[];
};

type AgentGroupDetails = AgentGroupListItem & {
  agents?: string[];
};

type MembershipTemplate = {
  id: string;
  name: string;
  durationDays: number;
  monthlyTokenLimit: number;
  includedAgents?: string[];
  includedGroupIds?: string[];
};

type DashboardUser = {
  id: string;
  email: string;
};

type RecentAssignment = {
  id: string;
  user: string;
  type: "Membership" | "Team" | "Agent";
  package: string;
  durationDays: number | null;
  tokens: number;
  assignedAt: string;
};

type AgentUsagePoint = {
  date: string;
  week?: string;
  total?: number;
  [agentName: string]: string | number | undefined;
};

type TopUserByAgent = {
  name: string;
  email: string;
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
};

type AgentMetricsResponse = {
  agents: string[];
  dailyUsage: AgentUsagePoint[];
  weeklyUsage: AgentUsagePoint[];
  topUsersByAgent: Record<string, TopUserByAgent[]>;
};

const inputKey = (agentName: string) => `${agentName}__input`;
const outputKey = (agentName: string) => `${agentName}__output`;

const getClaudeSonnet46Usd = (inputTokens = 0, outputTokens = 0) =>
  inputTokens * SONNET_4_6_INPUT_USD_PER_TOKEN +
  outputTokens * SONNET_4_6_OUTPUT_USD_PER_TOKEN;

const formatTokensAsCost = (
  tokens: number,
  currency: CurrencyMode,
  inputTokens?: number,
  outputTokens?: number,
): string => {
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
  // USD
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
};

const formatAxisValue = (value: number, currency: CurrencyMode): string => {
  if (currency === "tokens") return `${value / 1000}k`;
  const usd = currency === "EUR" ? value / EUR_RATE : value;
  if (currency === "EUR") {
    return `€${value.toFixed(value >= 1 ? 1 : 2)}`;
  }
  return `$${usd.toFixed(usd >= 1 ? 1 : 2)}`;
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
  active, payload, label, currency, colorMap,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name: string; value: number; color: string; stroke?: string }>;
  label?: string | number;
  currency: CurrencyMode;
  colorMap?: Record<string, string>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload]
    .filter((entry) => Number(entry.value) > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return null;
  return (
    <div style={{ backgroundColor: "#0f172a", border: "1px solid #ffffff15", borderRadius: "10px", padding: "10px 14px", fontSize: "12px" }}>
      <p style={{ color: "#ffffff80", marginBottom: 6 }}>{label}</p>
      {sorted.map((entry) => {
        const color = colorMap?.[entry.name] ?? entry.stroke ?? entry.color;
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

const buildDisplayUsageData = (
  usageData: AgentUsagePoint[],
  agents: string[],
  currency: CurrencyMode,
): AgentUsagePoint[] => {
  if (currency === "tokens") return usageData;

  const currencyMultiplier = currency === "EUR" ? EUR_RATE : 1;
  return usageData.map((point) => {
    const displayPoint: AgentUsagePoint = { ...point, total: 0 };

    agents.forEach((agent) => {
      const cost =
        getClaudeSonnet46Usd(
          Number(point[inputKey(agent)] ?? 0),
          Number(point[outputKey(agent)] ?? 0),
        ) * currencyMultiplier;
      displayPoint[agent] = cost;
      displayPoint.total = Number(displayPoint.total ?? 0) + cost;
    });

    return displayPoint;
  });
};

const formatRecentAssignmentDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));

async function parseApiError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join(", ");
  } catch {
    // Fall back to status text.
  }

  return response.statusText || "Request failed";
}

/* ──────────────── CURRENCY TOGGLE COMPONENT ──────────────── */

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

/* ──────────────────────────── COMPONENT ──────────────────────────── */

export default function AssignAndMetricsPage() {
  const [assignType, setAssignType] = useState<"membership" | "team" | "agent">("membership");
  const [userEmail, setUserEmail] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(100000);
  const [memberships, setMemberships] = useState<MembershipTemplate[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);
  const [isLoadingRecentAssignments, setIsLoadingRecentAssignments] = useState(false);
  const [recentAssignmentsError, setRecentAssignmentsError] = useState<string | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetricsResponse>({
    agents: [],
    dailyUsage: [],
    weeklyUsage: [],
    topUsersByAgent: {},
  });
  const [isLoadingAgentMetrics, setIsLoadingAgentMetrics] = useState(false);
  const [agentMetricsError, setAgentMetricsError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedAgentTab, setSelectedAgentTab] = useState("SARA_AI");
  const [visibleAgents, setVisibleAgents] = useState<string[]>(DEFAULT_VISIBLE_AGENTS);
  const [currency, setCurrency] = useState<CurrencyMode>("tokens");

  const toggleAgent = (agent: string) => {
    setVisibleAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  const typeColors: Record<string, string> = {
    Membership: "bg-emerald-500/20 text-emerald-400",
    Team: "bg-indigo-500/20 text-indigo-400",
    Agent: "bg-sky-500/20 text-sky-400",
  };

  const syncMembershipSelection = (templates: MembershipTemplate[]) => {
    const selected = templates[0];
    if (!selected) {
      setSelectedAssignment("");
      return;
    }

    setSelectedAssignment(selected.id);
    setDurationDays(selected.durationDays);
    setMonthlyTokenLimit(selected.monthlyTokenLimit);
  };

  const loadMemberships = async () => {
    setIsLoadingMemberships(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const templates = (await response.json()) as MembershipTemplate[];
      setMemberships(templates);
      if (assignType === "membership" && !templates.some((template) => template.id === selectedAssignment)) {
        syncMembershipSelection(templates);
      }
    } catch (error) {
      setMemberships([]);
      setAssignmentMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to load memberships.",
      });
    } finally {
      setIsLoadingMemberships(false);
    }
  };

  const loadTeams = async () => {
    setIsLoadingTeams(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/groups?limit=100&sortBy=createdAt&sortOrder=desc`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const payload = (await response.json()) as AgentGroupListResponse | AgentGroupListItem[];
      const groups = Array.isArray(payload) ? payload : payload.data ?? [];
      const details = await Promise.all(
        groups.map(async (group) => {
          const detailResponse = await authenticatedFetch(`${API_BASE}/admin/groups/${group.id}`, {
            cache: "no-store",
          });

          if (!detailResponse.ok) {
            return { ...group, agents: [] };
          }

          return (await detailResponse.json()) as AgentGroupDetails;
        }),
      );

      const loadedTeams = details.map((group) => ({
        id: group.id,
        name: group.name,
        agents: group.agents ?? [],
      }));

      setTeams(loadedTeams);
      if (assignType === "team" && !loadedTeams.some((team) => team.id === selectedAssignment)) {
        setSelectedAssignment(loadedTeams[0]?.id ?? "");
      }
    } catch (error) {
      setTeams([]);
      setAssignmentMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to load teams.",
      });
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const loadRecentAssignments = async () => {
    setIsLoadingRecentAssignments(true);
    setRecentAssignmentsError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/dashboard/recent-assignments?limit=6`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setRecentAssignments((await response.json()) as RecentAssignment[]);
    } catch (error) {
      setRecentAssignments([]);
      setRecentAssignmentsError(error instanceof Error ? error.message : "Unable to load recent assignments.");
    } finally {
      setIsLoadingRecentAssignments(false);
    }
  };

  const loadAgentMetrics = async () => {
    setIsLoadingAgentMetrics(true);
    setAgentMetricsError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/dashboard/usage/agent-metrics?days=30&topLimit=5`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const metrics = (await response.json()) as AgentMetricsResponse;
      const agents = Array.isArray(metrics.agents) ? metrics.agents : [];
      setAgentMetrics({
        agents,
        dailyUsage: Array.isArray(metrics.dailyUsage) ? metrics.dailyUsage : [],
        weeklyUsage: Array.isArray(metrics.weeklyUsage) ? metrics.weeklyUsage : [],
        topUsersByAgent: metrics.topUsersByAgent ?? {},
      });

      if (agents.length > 0) {
        setSelectedAgentTab((current) => (agents.includes(current) ? current : agents[0]));
        setVisibleAgents(agents);
      }
    } catch (error) {
      setAgentMetrics({
        agents: [],
        dailyUsage: [],
        weeklyUsage: [],
        topUsersByAgent: {},
      });
      setAgentMetricsError(error instanceof Error ? error.message : "Unable to load token usage metrics.");
    } finally {
      setIsLoadingAgentMetrics(false);
    }
  };

  useEffect(() => {
    void loadMemberships();
    void loadTeams();
    void loadRecentAssignments();
    void loadAgentMetrics();
  }, []);

  const updateAssignType = (type: "membership" | "team" | "agent") => {
    setAssignType(type);
    setAssignmentMessage(null);

    if (type === "membership") {
      syncMembershipSelection(memberships);
      return;
    }

    if (type === "team") {
      setSelectedAssignment(teams[0]?.id ?? "");
      setDurationDays(30);
      return;
    }

    setSelectedAssignment(ALL_AGENTS[0]);
    setDurationDays(30);
    setMonthlyTokenLimit(100000);
  };

  const handleAssignmentChange = (value: string) => {
    setSelectedAssignment(value);

    if (assignType === "membership") {
      const membership = memberships.find((item) => item.id === value);
      if (membership) {
        setDurationDays(membership.durationDays);
        setMonthlyTokenLimit(membership.monthlyTokenLimit);
      }
    }
  };

  const findUserIdByEmail = async (email: string) => {
    const response = await authenticatedFetch(`${API_BASE}/admin/dashboard/users?search=${encodeURIComponent(email)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const users = (await response.json()) as DashboardUser[];
    const exactMatch = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    const user = exactMatch ?? users[0];

    if (!user) {
      throw new Error(`No user found for ${email}.`);
    }

    return user.id;
  };

  const applyAssignment = async () => {
    const email = userEmail.trim();

    if (!email) {
      setAssignmentMessage({ type: "error", text: "User email is required." });
      return;
    }

    if (assignType === "team" && !selectedAssignment) {
      setAssignmentMessage({
        type: "error",
        text: "Select a team to assign.",
      });
      return;
    }

    if (assignType === "membership" && !selectedAssignment) {
      setAssignmentMessage({
        type: "error",
        text: "Select a membership to assign.",
      });
      return;
    }

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      setAssignmentMessage({
        type: "error",
        text: "Duration must be at least 1 day.",
      });
      return;
    }

    if (assignType === "agent" && (!Number.isInteger(monthlyTokenLimit) || monthlyTokenLimit < 0)) {
      setAssignmentMessage({
        type: "error",
        text: "Token assignment must be a non-negative integer.",
      });
      return;
    }

    setIsAssigning(true);
    setAssignmentMessage(null);

    try {
      if (assignType === "team") {
        const selectedTeam = teams.find((team) => team.id === selectedAssignment);
        const response = await authenticatedFetch(`${API_BASE}/admin/group-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            selector: { groupId: selectedAssignment },
            durationDays,
            isActive: true,
            alsoAssignAgents: true,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        setAssignmentMessage({
          type: "success",
          text: `${selectedTeam?.name ?? "Team"} assigned to ${email} for ${durationDays} days.`,
        });
        await loadRecentAssignments();
        await loadAgentMetrics();
        return;
      }

      if (assignType === "agent") {
        // 1) Grant the user access to this single agent (upserts AssignedAgent).
        const accessResponse = await authenticatedFetch(`${API_BASE}/admin/assign/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            agentName: selectedAssignment,
            durationDays,
            isActive: true,
          }),
        });

        if (!accessResponse.ok) {
          throw new Error(await parseApiError(accessResponse));
        }

        // 2) Apply the token allowance for that agent.
        const response = await authenticatedFetch(
          `${API_BASE}/token-usage/${encodeURIComponent(email)}/${encodeURIComponent(selectedAssignment)}/limit`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totalTokenLimit: monthlyTokenLimit }),
          },
        );

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        setAssignmentMessage({
          type: "success",
          text: `${selectedAssignment} assigned to ${email} for ${durationDays} days with ${monthlyTokenLimit.toLocaleString()} tokens.`,
        });
        await loadRecentAssignments();
        await loadAgentMetrics();
        return;
      }

      const selectedMembership = memberships.find((membership) => membership.id === selectedAssignment);
      const userId = await findUserIdByEmail(email);
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          membershipTemplateId: selectedAssignment,
          durationOverride: durationDays,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setAssignmentMessage({
        type: "success",
        text: `${selectedMembership?.name ?? "Membership"} assigned to ${email} for ${durationDays} days.`,
      });
      await loadRecentAssignments();
      await loadAgentMetrics();
    } catch (error) {
      setAssignmentMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to apply assignment.",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const metricAgents = agentMetrics.agents.length > 0 ? agentMetrics.agents : DEFAULT_VISIBLE_AGENTS;
  const selectedTopUsers = agentMetrics.topUsersByAgent[selectedAgentTab] ?? [];
  const agentColorMap = useMemo(
    () => Object.fromEntries(metricAgents.map((agent, index) => [agent, getAgentColor(agent, index)])),
    [metricAgents],
  );
  const displayDailyUsage = useMemo(
    () => buildDisplayUsageData(agentMetrics.dailyUsage, metricAgents, currency),
    [agentMetrics.dailyUsage, metricAgents, currency],
  );
  const displayWeeklyUsage = useMemo(
    () => buildDisplayUsageData(agentMetrics.weeklyUsage, metricAgents, currency),
    [agentMetrics.weeklyUsage, metricAgents, currency],
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignments & Metrics</h1>
          <p className="text-sm text-white/50">Assign memberships, teams, or individual agents to users and monitor system-wide usage</p>
        </div>
        {/* Page-level Currency Toggle */}
        <CurrencyToggle currency={currency} onChange={setCurrency} />
      </div>

      {/* ──────── ROW 1: Assignment Form + Recent Activity ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">

        {/* Assignment Form */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0F172A] p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <UserPlus size={20} className="text-indigo-400" /> New Assignment
          </h2>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              applyAssignment();
            }}
          >
            {/* Assignment Type Tabs */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Assignment Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["membership", "team", "agent"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateAssignType(type)}
                    className={`rounded-lg py-2 text-xs font-semibold capitalize transition ${
                      assignType === type
                        ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {type === "membership" && <CreditCard size={12} className="inline mr-1" />}
                    {type === "team" && <Users size={12} className="inline mr-1" />}
                    {type === "agent" && <Bot size={12} className="inline mr-1" />}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* User Email */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">User Email</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Search user by email..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Dynamic Package Selector */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">
                {assignType === "membership" ? "Select Membership" : assignType === "team" ? "Select Team" : "Select Agent"}
              </label>
              <select
                value={selectedAssignment}
                onChange={(e) => handleAssignmentChange(e.target.value)}
                disabled={(assignType === "team" && isLoadingTeams) || (assignType === "membership" && isLoadingMemberships)}
                className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-sm text-white outline-none transition focus:border-indigo-500 disabled:cursor-wait disabled:opacity-60"
                style={{ colorScheme: "dark" }}
              >
                {assignType === "membership" && (
                  isLoadingMemberships
                    ? <option value="">Loading memberships...</option>
                    : memberships.length > 0
                      ? memberships.map((m) => <option key={m.id} value={m.id}>{m.name} - {m.durationDays}d / {(m.monthlyTokenLimit / 1000).toFixed(0)}k tokens</option>)
                      : <option value="">No memberships available</option>
                )}
                {assignType === "team" && (
                  isLoadingTeams
                    ? <option value="">Loading teams...</option>
                    : teams.length > 0
                      ? teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.agents.length} agents)</option>)
                      : <option value="">No teams available</option>
                )}
                {assignType === "agent" && ALL_AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Duration & Token Limit */}
            <div className={`grid gap-4 ${assignType === "team" ? "grid-cols-1" : "grid-cols-2"}`}>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Duration (Days)</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              {assignType !== "team" && (
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Token Assignment</label>
                  <div className="relative">
                    <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={monthlyTokenLimit}
                      onChange={(e) => setMonthlyTokenLimit(Number(e.target.value))}
                      readOnly={assignType === "membership"}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none focus:border-indigo-500 transition read-only:text-white/60"
                    />
                  </div>
                </div>
              )}
            </div>

            {assignmentMessage && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                  assignmentMessage.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/20 bg-red-500/10 text-red-200"
                }`}
              >
                {assignmentMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{assignmentMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAssigning}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-indigo-500/20"
            >
              {isAssigning && <Loader2 size={16} className="animate-spin" />}
              Apply Assignment
            </button>
          </form>
        </div>

        {/* Recent Assignments Log */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0F172A] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock size={20} className="text-emerald-400" /> Recent Assignments
            </h2>
            <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/70">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">User</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">
                    {currency === "tokens" ? "Tokens/mo" : currency === "USD" ? "Cost/mo ($)" : "Cost/mo (€)"}
                  </th>
                  <th className="px-4 py-3 rounded-tr-lg">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingRecentAssignments && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading recent assignments...
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingRecentAssignments && recentAssignmentsError && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-red-300/80">
                      {recentAssignmentsError}
                    </td>
                  </tr>
                )}
                {!isLoadingRecentAssignments && !recentAssignmentsError && recentAssignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                      No assignments found.
                    </td>
                  </tr>
                )}
                {!isLoadingRecentAssignments && !recentAssignmentsError && recentAssignments.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3.5 font-medium text-white/90">{a.user}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeColors[a.type]}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{a.package}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{a.durationDays ? `${a.durationDays}d` : "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-sky-400">
                      {formatTokensAsCost(a.tokens, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-white/40">{formatRecentAssignmentDate(a.assignedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ──────── ROW 2: Stacked Area Chart ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" />
            {currency === "tokens"
              ? "Token Usage by Days (All Agents)"
              : `Cost by Days — ${currency === "USD" ? "$ USD" : "€ EUR"} (All Agents)`}
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Currency Toggle */}
            <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
            {/* Agent Toggle Chips */}
            <div className="flex flex-wrap gap-2">
              {metricAgents.map((agent, index) => (
                <button
                  key={agent}
                  onClick={() => toggleAgent(agent)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    visibleAgents.includes(agent)
                      ? "ring-1 ring-white/20 text-white"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full transition-opacity"
                    style={{ backgroundColor: getAgentColor(agent, index), opacity: visibleAgents.includes(agent) ? 1 : 0.3 }}
                  />
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>

        {agentMetricsError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {agentMetricsError}
          </div>
        )}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayDailyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {metricAgents.map((agent, index) => {
                  const color = getAgentColor(agent, index);
                  return (
                  <linearGradient key={agent} id={`grad-${agent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.24} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval={2} />
              <YAxis
                stroke="#ffffff40"
                fontSize={10}
                tickFormatter={(v) => formatAxisValue(v, currency)}
              />
              <Tooltip content={(props) => <SortedTooltip {...props} currency={currency} colorMap={agentColorMap} />} />
              {metricAgents.map((agent, index) => {
                const color = getAgentColor(agent, index);
                return (
                visibleAgents.includes(agent) ? (
                  <Area
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    stroke={color}
                    fill={`url(#grad-${agent})`}
                    strokeWidth={1.5}
                  />
                ) : null
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ──────── ROW 3: Weekly Stacked Area Chart ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity size={20} className="text-indigo-400" />
            {currency === "tokens"
              ? "Token Usage by Weeks (All Agents)"
              : `Cost by Weeks — ${currency === "USD" ? "$ USD" : "€ EUR"} (All Agents)`}
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
            <div className="flex flex-wrap gap-2">
              {metricAgents.map((agent, index) => (
                <button
                  key={agent}
                  onClick={() => toggleAgent(agent)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    visibleAgents.includes(agent)
                      ? "ring-1 ring-white/20 text-white"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full transition-opacity"
                    style={{ backgroundColor: getAgentColor(agent, index), opacity: visibleAgents.includes(agent) ? 1 : 0.3 }}
                  />
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayWeeklyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {metricAgents.map((agent, index) => {
                  const color = getAgentColor(agent, index);
                  return (
                  <linearGradient key={agent} id={`wgrad-${agent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.24} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={11} tickMargin={8} />
              <YAxis
                stroke="#ffffff40"
                fontSize={10}
                tickFormatter={(v) => formatAxisValue(v, currency)}
              />
              <Tooltip content={(props) => <SortedTooltip {...props} currency={currency} colorMap={agentColorMap} />} />
              {metricAgents.map((agent, index) => {
                const color = getAgentColor(agent, index);
                return (
                visibleAgents.includes(agent) ? (
                  <Area
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    stroke={color}
                    fill={`url(#wgrad-${agent})`}
                    strokeWidth={1.5}
                  />
                ) : null
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ──────── ROW 4: Top Users Per Agent ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={20} className="text-sky-400" /> Top Users by Agent
          </h2>
          <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
        </div>

        {/* Agent Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
          {metricAgents.map((agent, index) => (
            <button
              key={agent}
              onClick={() => setSelectedAgentTab(agent)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedAgentTab === agent
                  ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getAgentColor(agent, index) }} />
              {agent}
              <span className="ml-1 text-[10px] text-white/30">({agentMetrics.topUsersByAgent[agent]?.length ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Users Table for Selected Agent */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg w-8">#</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">
                  {currency === "tokens" ? "Total Tokens" : currency === "USD" ? "Total Cost ($)" : "Total Cost (€)"}
                </th>
                <th className="px-4 py-3 text-right rounded-tr-lg">% of Agent Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAgentMetrics && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/40">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading token usage metrics...
                    </span>
                  </td>
                </tr>
              )}
              {!isLoadingAgentMetrics && agentMetricsError && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-300/80">
                    {agentMetricsError}
                  </td>
                </tr>
              )}
              {!isLoadingAgentMetrics && !agentMetricsError && selectedTopUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/40">
                    No token usage found for {selectedAgentTab}.
                  </td>
                </tr>
              )}
              {!isLoadingAgentMetrics && !agentMetricsError && selectedTopUsers.map((user, idx) => {
                const agentTotal = selectedTopUsers.reduce((s, u) => s + u.tokens, 0);
                const pct = agentTotal > 0 ? (user.tokens / agentTotal) * 100 : 0;
                return (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition group">
                    <td className="px-4 py-3.5">
                      {idx < 3 ? (
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          idx === 0 ? "bg-amber-500/20 text-amber-400" :
                          idx === 1 ? "bg-slate-400/20 text-slate-300" :
                          "bg-orange-800/20 text-orange-400"
                        }`}>
                          {idx + 1}
                        </span>
                      ) : (
                        <span className="text-white/30 text-xs pl-1.5">{idx + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-white">{user.name}</td>
                    <td className="px-4 py-3.5 text-white/50">{user.email}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-sky-400">
                      {formatTokensAsCost(user.tokens, currency, user.inputTokens, user.outputTokens)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: getAgentColor(selectedAgentTab) }} />
                        </div>
                        <span className="text-xs text-white/40 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
