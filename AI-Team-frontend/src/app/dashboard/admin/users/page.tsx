"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Calendar, MoreVertical, Edit2, Trash2,
  ChevronDown, Users, Download, CreditCard, X,
  Activity, DollarSign, Euro
} from "lucide-react";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const USD_PER_TOKEN = 0.00003;
const EUR_RATE = 0.92;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ai-team-server.onrender.com";

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

/* ──────────────────────────── DATA MAPPING ──────────────────────────── */

type ApiAssignment = {
  agentName?: string;
  durationDays?: number | null;
  expiresAt?: string | null;
  startsAt?: string | null;
  isActive?: boolean;
};

type ApiGroupAssignment = ApiAssignment & {
  group?: { name?: string | null };
};

type ApiMembershipAssignment = {
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  template?: {
    name?: string;
    durationDays?: number;
    includedAgents?: string[];
  };
};

type ApiUser = {
  id: string;
  email: string;
  username?: string | null;
  agents?: ApiAssignment[];
  groups?: ApiGroupAssignment[];
  memberships?: ApiMembershipAssignment[];
  usage?: {
    monthly?: number;
    weekly?: number;
    daily?: number;
  };
};

type UsersResponse = {
  data: ApiUser[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  assigned: string[];
  membership: string;
  duration: number;
  expiration: string;
  monthlyUsage: number;
  weeklyUsage: number;
  dailyUsage: number;
  status: "active" | "expiring" | "expired";
};

type SortableUserField = keyof Pick<
  UserRow,
  "duration" | "monthlyUsage" | "weeklyUsage" | "dailyUsage"
>;

const formatDate = (value?: string | null) => {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toISOString().slice(0, 10);
};

const getStatus = (expiresAt?: string | null, isActive = true): UserRow["status"] => {
  if (!isActive) return "expired";
  if (!expiresAt) return "active";
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "active";
  const now = new Date();
  if (expiry <= now) return "expired";
  const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysLeft <= 14 ? "expiring" : "active";
};

const mapUser = (user: ApiUser): UserRow => {
  const activeAgents = (user.agents ?? []).filter((item) => item.isActive !== false);
  const activeGroups = (user.groups ?? []).filter((item) => item.isActive !== false);
  const activeMemberships = (user.memberships ?? []).filter((item) => item.isActive !== false);
  const primaryMembership = activeMemberships[0];
  const primaryTimedAssignment = activeGroups[0] ?? activeAgents[0];
  const hasActiveAccess = Boolean(primaryMembership || primaryTimedAssignment);
  const assignedGroups = activeGroups.map((item) => item.group?.name).filter(Boolean) as string[];
  const assignedAgents = activeAgents.map((item) => item.agentName).filter(Boolean) as string[];
  const assigned = assignedGroups.length > 0 ? assignedGroups : assignedAgents;

  if (assigned.length === 0 && primaryMembership?.template?.includedAgents?.length) {
    assigned.push(...primaryMembership.template.includedAgents);
  }

  return {
    id: user.id,
    name: user.username || user.email.split("@")[0] || "Unnamed user",
    email: user.email,
    assigned: Array.from(new Set(assigned)),
    membership: primaryMembership?.template?.name ?? "No membership",
    duration: primaryMembership?.template?.durationDays ?? primaryTimedAssignment?.durationDays ?? 0,
    expiration: formatDate(primaryMembership?.expiresAt ?? primaryTimedAssignment?.expiresAt),
    monthlyUsage: user.usage?.monthly ?? 0,
    weeklyUsage: user.usage?.weekly ?? 0,
    dailyUsage: user.usage?.daily ?? 0,
    status: hasActiveAccess
      ? getStatus(
          primaryMembership?.expiresAt ?? primaryTimedAssignment?.expiresAt,
          (primaryMembership?.isActive ?? primaryTimedAssignment?.isActive) !== false,
        )
      : "expired",
  };
};

const TIMEFRAME_PRESETS = [
  "Today", "Yesterday", "Last 7 Days", "This Week", "Last Week",
  "This Month", "Last Month"
];

const STATUS_OPTIONS = ["All", "Active", "Expiring", "Expired"];

/* ──────────────────────────── COMPONENT ──────────────────────────── */

export default function AllUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState("This Month");
  const [membershipFilter, setMembershipFilter] = useState("All Memberships");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showTimeframePicker, setShowTimeframePicker] = useState(false);
  const [customDays, setCustomDays] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [sortField, setSortField] = useState<SortableUserField>("monthlyUsage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currency, setCurrency] = useState<CurrencyMode>("tokens");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<UsersResponse["meta"]>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "10");
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Users request failed with ${response.status}`);
        }

        const data = (await response.json()) as UsersResponse;
        setUsers(Array.isArray(data.data) ? data.data.map(mapUser) : []);
        setPagination(data.meta);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Failed to load users");
          setUsers([]);
          setPagination(undefined);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    const timer = window.setTimeout(loadUsers, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    if (selectedUsers.length === filteredUsers.length) setSelectedUsers([]);
    else setSelectedUsers(filteredUsers.map((u) => u.id));
  };

  const membershipOptions = useMemo(
    () => ["All Memberships", ...Array.from(new Set(users.map((u) => u.membership).filter(Boolean)))],
    [users],
  );

  const filteredUsers = users
    .filter((u) => {
      const matchesMembership = membershipFilter === "All Memberships" || u.membership === membershipFilter;
      const matchesStatus = statusFilter === "All" || u.status === statusFilter.toLowerCase();
      return matchesMembership && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

  const handleSort = (field: SortableUserField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const activeTimeLabel = (() => {
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    if (customDays) return `Last ${customDays} days`;
    return timeframe;
  })();

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-500/15 text-emerald-400",
      expiring: "bg-amber-500/15 text-amber-400",
      expired: "bg-red-500/15 text-red-400",
    };
    return map[status] || "";
  };

  const totalUsers = pagination?.total ?? filteredUsers.length;
  const totalMonthlyTokens = filteredUsers.reduce((s, u) => s + u.monthlyUsage, 0);

  const usageColLabel = (base: string) => {
    if (currency === "USD") return `${base} ($)`;
    if (currency === "EUR") return `${base} (€)`;
    return base;
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">All Users</h1>
        <p className="text-sm text-white/50">Manage user accounts, assignments, and token usage</p>
      </div>

      {/* ──────── SUMMARY CARDS ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Total Users</p>
            <p className="text-xl font-bold">{totalUsers}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              {currency === "tokens" ? "Total Monthly Tokens" : currency === "USD" ? "Total Monthly Cost ($)" : "Total Monthly Cost (€)"}
            </p>
            <p className="text-xl font-bold font-mono text-sky-400">
              {formatTokensAsCost(totalMonthlyTokens, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* ──────── FILTERS & ACTIONS BAR ──────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search by name, email, membership, agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/40 focus:border-sky-500 focus:outline-none transition"
            />
          </div>

          {/* Membership Filter */}
          <select
            value={membershipFilter}
            onChange={(e) => setMembershipFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0F172A] py-2.5 px-3 text-sm text-white/70 outline-none hover:bg-white/5 transition appearance-none pr-8"
          >
            {membershipOptions.map((m) => <option key={m}>{m}</option>)}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0F172A] py-2.5 px-3 text-sm text-white/70 outline-none hover:bg-white/5 transition appearance-none pr-8"
          >
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>

          {/* Timeframe Selector */}
          <div className="relative">
            <button
              onClick={() => setShowTimeframePicker(!showTimeframePicker)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] py-2.5 px-3 text-sm text-white/70 hover:bg-white/5 transition"
            >
              <Calendar size={14} className="text-sky-400" />
              <span>{activeTimeLabel}</span>
              <ChevronDown size={12} className={`text-white/40 transition-transform ${showTimeframePicker ? "rotate-180" : ""}`} />
            </button>

            {showTimeframePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#0B1221] p-4 shadow-2xl shadow-black/40">
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Presets</p>
                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  {TIMEFRAME_PRESETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTimeframe(t); setCustomDays(""); setCustomFrom(""); setCustomTo(""); setShowTimeframePicker(false); }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        timeframe === t && !customDays && !customFrom
                          ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">Last N Days</p>
                <div className="flex gap-2 mb-3">
                  <input type="number" min={1} placeholder="e.g. 14" value={customDays} onChange={(e) => setCustomDays(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-sky-500"
                  />
                  <button onClick={() => { if (customDays) { setTimeframe(""); setCustomFrom(""); setCustomTo(""); setShowTimeframePicker(false); } }}
                    className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">Apply</button>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">Custom Range</p>
                <div className="flex gap-2 items-end">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-sky-500" />
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-sky-500" />
                  <button onClick={() => { if (customFrom && customTo) { setTimeframe(""); setCustomDays(""); setShowTimeframePicker(false); } }}
                    className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">Go</button>
                </div>
              </div>
            )}
          </div>

          {/* Currency Toggle */}
          <CurrencyToggle currency={currency} onChange={setCurrency} size="small" />
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-sky-400 font-medium px-2">{selectedUsers.length} selected</span>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-sm text-sky-400 hover:bg-sky-500/20 transition"
            >
              <Edit2 size={14} /> Bulk Edit
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* ──────── BULK EDIT MODAL ──────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1221] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Bulk Edit — {selectedUsers.length} Users</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">New Duration (Days)</label>
                <input type="number" placeholder="Leave blank to keep" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">New Expiration Date</label>
                <input type="date" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">New Monthly Token Limit</label>
                <input type="number" placeholder="Leave blank to keep" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-sky-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/60 hover:bg-white/5 transition">Cancel</button>
                <button onClick={() => setShowBulkModal(false)} className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 transition shadow-lg shadow-sky-500/20">Apply Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────── USERS TABLE ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F172A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input type="checkbox" checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0} onChange={toggleAll} className="rounded border-white/20 bg-transparent text-sky-500 focus:ring-sky-500" />
                </th>
                <th className="px-4 py-4 font-semibold">User</th>
                <th className="px-4 py-4 font-semibold">Assigned</th>
                <th className="px-4 py-4 font-semibold">Membership</th>
                <th className="px-4 py-4 font-semibold cursor-pointer hover:text-white transition" onClick={() => handleSort("duration")}>
                  Duration {sortField === "duration" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4 font-semibold">Expiration</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition" onClick={() => handleSort("monthlyUsage")}>
                  {usageColLabel("Monthly")} {sortField === "monthlyUsage" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition" onClick={() => handleSort("weeklyUsage")}>
                  {usageColLabel("Weekly")} {sortField === "weeklyUsage" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition" onClick={() => handleSort("dailyUsage")}>
                  {usageColLabel("Daily")} {sortField === "dailyUsage" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-white/40">Loading real users...</td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-red-300">{error}</td>
                </tr>
              )}
              {!isLoading && !error && filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.03] transition group">
                  <td className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-white/20 bg-transparent text-sky-500 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/dashboard/admin/users/${user.id}`} className="flex flex-col hover:text-sky-400 transition">
                      <span className="font-medium text-white">{user.email}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {user.assigned.length > 0 ? (
                        user.assigned.map((a) => (
                          <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                        ))
                      ) : (
                        <span className="text-[11px] text-white/30">No access</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-white/70">{user.membership}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">{user.duration}d</td>
                  <td className="px-4 py-4 text-xs">{user.expiration}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sky-300">
                    {formatTokensAsCost(user.monthlyUsage, currency)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sky-400/70">
                    {formatTokensAsCost(user.weeklyUsage, currency)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sky-400/50">
                    {formatTokensAsCost(user.dailyUsage, currency)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-white/30 hover:text-white transition opacity-0 group-hover:opacity-100"><MoreVertical size={16} /></button>
                  </td>
                </tr>
              ))}
              {!isLoading && !error && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-white/40">No users found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/40">
          <span>
            Showing {filteredUsers.length} of {pagination?.total ?? users.length} users
            {pagination ? ` - Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}` : ""}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination?.hasPreviousPage || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-md border border-white/10 px-2 py-1 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={!pagination?.hasNextPage || isLoading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-white/10 px-2 py-1 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <button className="flex items-center gap-1.5 text-white/50 hover:text-white transition">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
