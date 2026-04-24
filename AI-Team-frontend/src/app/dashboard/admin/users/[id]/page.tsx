"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, User as UserIcon, Calendar, Activity, CreditCard,
  Bot, Clock, ChevronDown, OctagonAlert, Shield, Mail, Hash,
  DollarSign, Euro
} from "lucide-react";
import {
  Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from "recharts";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const USD_PER_TOKEN = 0.00003;
const EUR_RATE = 0.92;

type CurrencyMode = "tokens" | "USD" | "EUR";

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

const MOCK_USER = {
  name: "Mario Rossi",
  email: "mario@example.com",
  oauthId: "oauth_abc123",
  joinedDate: "2023-06-15",
  subscription: {
    plan: "1 year Sara AI & JIM",
    type: "Membership",
    duration: 365,
    startsAt: "2024-01-01",
    expiration: "2024-12-31",
    monthlyLimit: 150000,
    usedThisCycle: 145200,
    status: "Active",
    agents: ["SARA_AI", "JIM"],
  },
};

const generateDailyData = () => {
  const agents = ["SARA_AI", "JIM"];
  const days: any[] = [];
  for (let i = 1; i <= 30; i++) {
    const d: any = { date: `Oct ${i}` };
    let dayTotal = 0;
    agents.forEach((a) => {
      const val = Math.floor(Math.random() * 6000) + 1000;
      d[a] = val;
      dayTotal += val;
    });
    d.total = dayTotal;
    d.stops = dayTotal > 10000 ? Math.ceil(Math.random() * 3) : 0;
    days.push(d);
  }
  return days;
};
const MOCK_DAILY_USAGE = generateDailyData();

const MOCK_WEEKLY_USAGE = [
  { week: "Week 1", SARA_AI: 25000, JIM: 12000, stops: 1 },
  { week: "Week 2", SARA_AI: 35000, JIM: 8000,  stops: 3 },
  { week: "Week 3", SARA_AI: 40000, JIM: 15000, stops: 5 },
  { week: "Week 4", SARA_AI: 18000, JIM: 5000,  stops: 0 },
];

const MOCK_AGENT_USAGE = [
  { name: "SARA_AI", value: 118000, color: "#38bdf8" },
  { name: "JIM",     value: 40200,  color: "#f472b6" },
];

const totalStops = MOCK_DAILY_USAGE.reduce((s, d) => s + d.stops, 0);

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

  const usagePercent = (MOCK_USER.subscription.usedThisCycle / MOCK_USER.subscription.monthlyLimit) * 100;
  const daysRemaining = Math.max(0, Math.ceil((new Date(MOCK_USER.subscription.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Back link */}
      <Link href="/dashboard/admin/users" className="mb-6 inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition">
        <ArrowLeft size={16} /> Back to Users
      </Link>

      {/* ──────── HEADER ROW ──────── */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        {/* User identity */}
        <div className="flex items-start gap-5">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-400 ring-1 ring-white/10">
            <UserIcon size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{MOCK_USER.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
              <span className="flex items-center gap-1"><Mail size={13} /> {MOCK_USER.email}</span>
              <span className="flex items-center gap-1"><Hash size={13} /> {MOCK_USER.oauthId}</span>
              <span className="flex items-center gap-1"><Calendar size={13} /> Joined {MOCK_USER.joinedDate}</span>
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
          <p className="font-semibold text-sm leading-snug">{MOCK_USER.subscription.plan}</p>
          <span className="mt-2 inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
            {MOCK_USER.subscription.status}
          </span>
        </div>

        {/* Duration */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5 flex items-center gap-1"><Clock size={11} /> Duration</p>
          <p className="font-semibold text-sm">{MOCK_USER.subscription.duration} days</p>
          <p className="text-[11px] text-white/40 mt-1">{MOCK_USER.subscription.startsAt} → {MOCK_USER.subscription.expiration}</p>
        </div>

        {/* Expiration */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5 flex items-center gap-1"><Calendar size={11} /> Expiration</p>
          <p className="font-semibold text-sm">{MOCK_USER.subscription.expiration}</p>
          <p className="text-[11px] text-amber-400/70 mt-1">{daysRemaining} days remaining</p>
        </div>

        {/* Monthly limit */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">Monthly Limit</p>
          <p className="font-mono text-lg text-sky-400">
            {formatTokensAsCost(MOCK_USER.subscription.monthlyLimit, currency)}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
          </div>
        </div>

        {/* Used this cycle */}
        <div className={`rounded-xl border p-4 ${usagePercent >= 90 ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
          <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${usagePercent >= 90 ? "text-red-400/60" : "text-white/35"}`}>Used This Cycle</p>
          <p className={`font-mono text-lg ${usagePercent >= 90 ? "text-red-400" : "text-white"}`}>
            {formatTokensAsCost(MOCK_USER.subscription.usedThisCycle, currency)}
          </p>
          <p className={`text-[10px] mt-1 uppercase tracking-wider ${usagePercent >= 90 ? "text-red-400/50" : "text-white/30"}`}>
            {usagePercent.toFixed(1)}% used · {totalStops} stops
          </p>
        </div>
      </div>

      {/* ──────── ASSIGNED AGENTS CHIPS ──────── */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-3 flex items-center gap-1"><Shield size={11} /> Assigned Agents</p>
        <div className="flex flex-wrap gap-2">
          {MOCK_USER.subscription.agents.map((a) => (
            <span key={a} className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 ring-1 ring-sky-500/20">
              <Bot size={13} /> {a}
            </span>
          ))}
        </div>
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
          <div className="flex items-center gap-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> SARA_AI</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pink-400" /> JIM</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Stops</span>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MOCK_DAILY_USAGE} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSaraDay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradJimDay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f472b6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickMargin={8} interval={2} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                itemStyle={{ color: "#fff" }}
                formatter={((value: number, name: string) => [formatTokensAsCost(value, currency), name]) as any}
                labelStyle={{ color: "#ffffff80" }}
              />
              <Bar dataKey="SARA_AI" stackId="stack" fill="url(#gradSaraDay)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="JIM"     stackId="stack" fill="url(#gradJimDay)"  radius={[3, 3, 0, 0]} />

              <Line
                type="monotone"
                dataKey="stops"
                stroke="none"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.stops > 0) {
                    return (
                      <g key={`stop-${payload.date}`}>
                        <circle cx={cx} cy={20} r={8} fill="#ef444440" />
                        <circle cx={cx} cy={20} r={5} fill="#ef4444" />
                        <text x={cx} y={24} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>{payload.stops}</text>
                      </g>
                    );
                  }
                  return <g key={`no-stop-${payload.date}`} />;
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
          <div className="flex items-center gap-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> SARA_AI</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pink-400" /> JIM</span>
            <span className="flex items-center gap-1.5"><OctagonAlert size={11} className="text-red-400" /> Stops</span>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MOCK_WEEKLY_USAGE} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" stroke="#ffffff40" fontSize={12} tickMargin={10} />
              <YAxis stroke="#ffffff40" fontSize={12} tickFormatter={(v) => formatAxisValue(v, currency)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                cursor={{ fill: "#ffffff05" }}
                formatter={((value: number, name: string) => [formatTokensAsCost(value, currency), name]) as any}
              />
              <Legend iconType="circle" />
              <Bar dataKey="SARA_AI" stackId="a" fill="#38bdf8" radius={[0, 0, 4, 4]} />
              <Bar dataKey="JIM"     stackId="a" fill="#f472b6" radius={[4, 4, 0, 0]} />

              <Line
                type="monotone"
                dataKey="stops"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.stops > 0) {
                    return (
                      <g key={`ws-${payload.week}`}>
                        <circle cx={cx} cy={cy} r={10} fill="#ef444420" />
                        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#0f172a" strokeWidth={2} />
                        <text x={cx} y={cy + 3.5} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>{payload.stops}</text>
                      </g>
                    );
                  }
                  return <g key={`wns-${payload.week}`} />;
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
                <Pie data={MOCK_AGENT_USAGE} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {MOCK_AGENT_USAGE.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#ffffff15", borderRadius: "10px", fontSize: "12px" }}
                  formatter={(value: any) => [formatTokensAsCost(Number(value), currency), ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 flex-1">
            {MOCK_AGENT_USAGE.map((a) => (
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
            <p className="text-3xl font-bold text-red-400">{totalStops}</p>
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
