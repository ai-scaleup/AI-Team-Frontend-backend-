"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  UserPlus, Calendar, CreditCard, Activity, TrendingUp, Search,
  Bot, Users, Clock,
  DollarSign, Euro, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ai-team-server.onrender.com";

/* ──────────────────────────── MOCK DATA ──────────────────────────── */

const ALL_AGENTS = [
  "SARA_AI", "JENNIFER_AI", "CHIARA_AI", "JIM", "ALEX", "MIKE", "TONY",
  "LARA", "VALENTINA", "DANIELE", "SIMONE", "NIKO", "ALADINO", "LAURA", "DAN",
  "MAX", "SOFIA", "ROBERTA", "TEST_JIM", "TEST_ALEX", "TEST_MIKE", "TEST_TONY",
  "TEST_LARA", "TEST_VALENTINA", "TEST_DANIELE", "TEST_SIMONE", "TEST_NIKO",
  "TEST_ALADINO", "TEST_LAURA", "TEST_DAN", "TEST_MAX", "TEST_SOFIA",
  "TEST_ROBERTA", "TEST_SARA_AI", "TEST_JENNIFER_AI", "TEST_CHIARA_AI",
];

//ddd

const MOCK_MEMBERSHIPS = [
  { name: "1 year Sara AI", duration: 365, tokens: 500000 },
  { name: "3 months Ai Team", duration: 90, tokens: 2000000 },
  { name: "Starter Bundle", duration: 30, tokens: 100000 },
  { name: "1 year Ai Team", duration: 365, tokens: 5000000 },
  { name: "6 months Jennifer AI", duration: 180, tokens: 300000 },
];

// 30 days of stacked agent usage data
const generateDailyUsage = () => {
  const days = [];
  for (let i = 1; i <= 30; i++) {
    days.push({
      date: `Oct ${i}`,
      SARA_AI: Math.floor(Math.random() * 8000) + 2000,
      JENNIFER_AI: Math.floor(Math.random() * 6000) + 1000,
      CHIARA_AI: Math.floor(Math.random() * 5000) + 800,
      JIM: Math.floor(Math.random() * 3000) + 500,
      ALEX: Math.floor(Math.random() * 2500) + 300,
      MIKE: Math.floor(Math.random() * 2000) + 200,
    });
  }
  return days;
};
const MOCK_DAILY_USAGE = generateDailyUsage();

// Aggregate daily data into 4 weeks
const MOCK_WEEKLY_USAGE = [0, 1, 2, 3].map((w) => {
  const slice = MOCK_DAILY_USAGE.slice(w * 7, w * 7 + 7);
  return {
    week: `Week ${w + 1}`,
    SARA_AI:     slice.reduce((s, d) => s + d.SARA_AI,     0),
    JENNIFER_AI: slice.reduce((s, d) => s + d.JENNIFER_AI, 0),
    CHIARA_AI:   slice.reduce((s, d) => s + d.CHIARA_AI,   0),
    JIM:         slice.reduce((s, d) => s + d.JIM,         0),
    ALEX:        slice.reduce((s, d) => s + d.ALEX,        0),
    MIKE:        slice.reduce((s, d) => s + d.MIKE,        0),
  };
});

const AGENT_COLORS: Record<string, string> = {
  SARA_AI: "#38bdf8",
  JENNIFER_AI: "#818cf8",
  CHIARA_AI: "#34d399",
  JIM: "#f472b6",
  ALEX: "#fb923c",
  MIKE: "#a78bfa",
};

// Top users broken down per agent
const MOCK_TOP_USERS_BY_AGENT: Record<string, { name: string; email: string; tokens: number }[]> = {
  SARA_AI: [
    { name: "Mario Rossi", email: "mario@example.com", tokens: 145200 },
    { name: "Giulia Bianchi", email: "giulia@example.com", tokens: 98700 },
    { name: "Luca Moretti", email: "luca@example.com", tokens: 67300 },
    { name: "Elena Conti", email: "elena@example.com", tokens: 45800 },
    { name: "Marco Ferraro", email: "marco@example.com", tokens: 32100 },
  ],
  JENNIFER_AI: [
    { name: "Luigi Verdi", email: "luigi@example.com", tokens: 112500 },
    { name: "Sofia Romano", email: "sofia@example.com", tokens: 87200 },
    { name: "Andrea Colombo", email: "andrea@example.com", tokens: 54300 },
    { name: "Chiara Ricci", email: "chiara@example.com", tokens: 38700 },
    { name: "Davide Galli", email: "davide@example.com", tokens: 21900 },
  ],
  CHIARA_AI: [
    { name: "Anna Neri", email: "anna@example.com", tokens: 76400 },
    { name: "Francesco Mancini", email: "francesco@example.com", tokens: 65200 },
    { name: "Valentina Costa", email: "valentina@example.com", tokens: 43100 },
    { name: "Roberto Esposito", email: "roberto@example.com", tokens: 29800 },
  ],
  JIM: [
    { name: "Paolo Gialli", email: "paolo@example.com", tokens: 45600 },
    { name: "Alessia Marino", email: "alessia@example.com", tokens: 34200 },
    { name: "Simone Bruno", email: "simone@example.com", tokens: 21800 },
  ],
  ALEX: [
    { name: "Giorgio Greco", email: "giorgio@example.com", tokens: 38900 },
    { name: "Federica De Luca", email: "federica@example.com", tokens: 27400 },
  ],
  MIKE: [
    { name: "Matteo Fontana", email: "matteo@example.com", tokens: 19200 },
    { name: "Laura Pellegrini", email: "laura@example.com", tokens: 14800 },
  ],
};

// Recent assignments log
const MOCK_RECENT_ASSIGNMENTS = [
  { user: "mario@example.com", type: "Membership", package: "1 year Sara AI", date: "Oct 28", tokens: 500000, duration: "365d" },
  { user: "luigi@example.com", type: "Team", package: "Marketing Powerhouse", date: "Oct 27", tokens: 200000, duration: "90d" },
  { user: "anna@example.com", type: "Agent", package: "CHIARA_AI", date: "Oct 26", tokens: 100000, duration: "30d" },
  { user: "paolo@example.com", type: "Agent", package: "JIM", date: "Oct 25", tokens: 150000, duration: "60d" },
  { user: "giulia@example.com", type: "Membership", package: "3 months Ai Team", date: "Oct 24", tokens: 2000000, duration: "90d" },
  { user: "sofia@example.com", type: "Team", package: "Sales Closers", date: "Oct 23", tokens: 300000, duration: "180d" },
];

/* ──────────────── CURRENCY HELPERS ──────────────── */

// Mock cost rate: $0.03 per 1,000 tokens
const USD_PER_TOKEN = 0.00003;
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

const formatTokensAsCost = (tokens: number, currency: CurrencyMode): string => {
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
  // USD
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
};

const formatAxisValue = (value: number, currency: CurrencyMode): string => {
  if (currency === "tokens") return `${value / 1000}k`;
  const usd = value * USD_PER_TOKEN;
  if (currency === "EUR") {
    const eur = usd * EUR_RATE;
    return `€${eur.toFixed(2)}`;
  }
  return `$${usd.toFixed(2)}`;
};

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
  const [selectedAssignment, setSelectedAssignment] = useState(MOCK_MEMBERSHIPS[0].name);
  const [durationDays, setDurationDays] = useState(MOCK_MEMBERSHIPS[0].duration);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(MOCK_MEMBERSHIPS[0].tokens);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedAgentTab, setSelectedAgentTab] = useState("SARA_AI");
  const [visibleAgents, setVisibleAgents] = useState<string[]>(["SARA_AI", "JENNIFER_AI", "CHIARA_AI", "JIM"]);
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

  const loadTeams = async () => {
    setIsLoadingTeams(true);

    try {
      const response = await fetch(`${API_BASE}/admin/groups?limit=100&sortBy=createdAt&sortOrder=desc`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const payload = (await response.json()) as AgentGroupListResponse | AgentGroupListItem[];
      const groups = Array.isArray(payload) ? payload : payload.data ?? [];
      const details = await Promise.all(
        groups.map(async (group) => {
          const detailResponse = await fetch(`${API_BASE}/admin/groups/${group.id}`, {
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

  useEffect(() => {
    void loadTeams();
  }, []);

  const updateAssignType = (type: "membership" | "team" | "agent") => {
    setAssignType(type);
    setAssignmentMessage(null);

    if (type === "membership") {
      setSelectedAssignment(MOCK_MEMBERSHIPS[0].name);
      setDurationDays(MOCK_MEMBERSHIPS[0].duration);
      setMonthlyTokenLimit(MOCK_MEMBERSHIPS[0].tokens);
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
      const membership = MOCK_MEMBERSHIPS.find((item) => item.name === value);
      if (membership) {
        setDurationDays(membership.duration);
        setMonthlyTokenLimit(membership.tokens);
      }
    }
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
        const response = await fetch(`${API_BASE}/admin/group-assignments`, {
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
        return;
      }

      if (assignType === "agent") {
        const response = await fetch(
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
          text: `${monthlyTokenLimit.toLocaleString()} tokens assigned to ${selectedAssignment} for ${email}.`,
        });
        return;
      }

      setAssignmentMessage({
        type: "error",
        text: "Membership assignment is not connected yet.",
      });
    } catch (error) {
      setAssignmentMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to apply assignment.",
      });
    } finally {
      setIsAssigning(false);
    }
  };

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
                disabled={assignType === "team" && isLoadingTeams}
                className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-sm text-white outline-none transition focus:border-indigo-500 disabled:cursor-wait disabled:opacity-60"
                style={{ colorScheme: "dark" }}
              >
                {assignType === "membership" && MOCK_MEMBERSHIPS.map((m) => <option key={m.name} value={m.name}>{m.name} — {m.duration}d / {(m.tokens / 1000).toFixed(0)}k tokens</option>)}
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
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none focus:border-indigo-500 transition"
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
                {MOCK_RECENT_ASSIGNMENTS.map((a, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3.5 font-medium text-white/90">{a.user}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeColors[a.type]}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{a.package}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{a.duration}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-sky-400">
                      {formatTokensAsCost(a.tokens, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-white/40">{a.date}</td>
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
              {Object.keys(AGENT_COLORS).map((agent) => (
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
                    style={{ backgroundColor: AGENT_COLORS[agent], opacity: visibleAgents.includes(agent) ? 1 : 0.3 }}
                  />
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_DAILY_USAGE} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(AGENT_COLORS).map(([agent, color]) => (
                  <linearGradient key={agent} id={`grad-${agent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval={2} />
              <YAxis
                stroke="#ffffff40"
                fontSize={10}
                tickFormatter={(v) => formatAxisValue(v, currency)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value, name) => [formatTokensAsCost(Number(value), currency), String(name)]}
                labelStyle={{ color: "#ffffff80" }}
              />
              {Object.entries(AGENT_COLORS).map(([agent, color]) =>
                visibleAgents.includes(agent) ? (
                  <Area
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    stackId="1"
                    stroke={color}
                    fill={`url(#grad-${agent})`}
                    strokeWidth={1.5}
                  />
                ) : null
              )}
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
              {Object.keys(AGENT_COLORS).map((agent) => (
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
                    style={{ backgroundColor: AGENT_COLORS[agent], opacity: visibleAgents.includes(agent) ? 1 : 0.3 }}
                  />
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_WEEKLY_USAGE} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(AGENT_COLORS).map(([agent, color]) => (
                  <linearGradient key={agent} id={`wgrad-${agent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.65} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={11} tickMargin={8} />
              <YAxis
                stroke="#ffffff40"
                fontSize={10}
                tickFormatter={(v) => formatAxisValue(v, currency)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value, name) => [formatTokensAsCost(Number(value), currency), String(name)]}
                labelStyle={{ color: "#ffffff80" }}
              />
              {Object.entries(AGENT_COLORS).map(([agent, color]) =>
                visibleAgents.includes(agent) ? (
                  <Area
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    stackId="w"
                    stroke={color}
                    fill={`url(#wgrad-${agent})`}
                    strokeWidth={1.5}
                  />
                ) : null
              )}
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
          {Object.keys(MOCK_TOP_USERS_BY_AGENT).map((agent) => (
            <button
              key={agent}
              onClick={() => setSelectedAgentTab(agent)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedAgentTab === agent
                  ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AGENT_COLORS[agent] || "#94a3b8" }} />
              {agent}
              <span className="ml-1 text-[10px] text-white/30">({MOCK_TOP_USERS_BY_AGENT[agent].length})</span>
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
              {MOCK_TOP_USERS_BY_AGENT[selectedAgentTab]?.map((user, idx) => {
                const agentTotal = MOCK_TOP_USERS_BY_AGENT[selectedAgentTab].reduce((s, u) => s + u.tokens, 0);
                const pct = (user.tokens / agentTotal) * 100;
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
                      {formatTokensAsCost(user.tokens, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: AGENT_COLORS[selectedAgentTab] || "#38bdf8" }} />
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
