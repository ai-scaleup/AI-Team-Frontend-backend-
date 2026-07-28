"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Calendar, MoreVertical, Edit2, Trash2,
  ChevronDown, ChevronUp, Users, Download, CreditCard, X,
  Activity, DollarSign, Euro
} from "lucide-react";

/* ──────────────── CURRENCY HELPERS ──────────────── */

const SONNET_4_6_INPUT_USD_PER_TOKEN = 3 / 1000000;
const SONNET_4_6_OUTPUT_USD_PER_TOKEN = 15 / 1000000;
const EUR_RATE = 0.92;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

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
  if (currency === "tokens") {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    return `${(tokens / 1000).toFixed(1)}k`;
  }
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
    monthlyInputTokens?: number;
    monthlyOutputTokens?: number;
    weekly?: number;
    weeklyInputTokens?: number;
    weeklyOutputTokens?: number;
    daily?: number;
    dailyInputTokens?: number;
    dailyOutputTokens?: number;
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
    summary?: {
      monthlyTokens?: number;
      monthlyInputTokens?: number;
      monthlyOutputTokens?: number;
    };
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
  monthlyInputUsage: number;
  monthlyOutputUsage: number;
  weeklyUsage: number;
  weeklyInputUsage: number;
  weeklyOutputUsage: number;
  dailyUsage: number;
  dailyInputUsage: number;
  dailyOutputUsage: number;
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
    monthlyInputUsage: user.usage?.monthlyInputTokens ?? 0,
    monthlyOutputUsage: user.usage?.monthlyOutputTokens ?? 0,
    weeklyUsage: user.usage?.weekly ?? 0,
    weeklyInputUsage: user.usage?.weeklyInputTokens ?? 0,
    weeklyOutputUsage: user.usage?.weeklyOutputTokens ?? 0,
    dailyUsage: user.usage?.daily ?? 0,
    dailyInputUsage: user.usage?.dailyInputTokens ?? 0,
    dailyOutputUsage: user.usage?.dailyOutputTokens ?? 0,
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

const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const endOfDay = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };
const DAY_MS = 24 * 60 * 60 * 1000;

const getUsageRange = (
  timeframe: string,
  customDays: string,
  customFrom: string,
  customTo: string,
): { from?: Date; to?: Date } => {
  const now = new Date();
  if (customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { from: startOfDay(from), to: endOfDay(to) };
    }
  }
  const days = Number(customDays);
  if (customDays && Number.isFinite(days) && days > 0) {
    return { from: new Date(now.getTime() - days * DAY_MS), to: now };
  }
  switch (timeframe) {
    case "Today":
      return { from: startOfDay(now), to: now };
    case "Yesterday": {
      const y = new Date(now.getTime() - DAY_MS);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "Last 7 Days":
      return { from: new Date(now.getTime() - 7 * DAY_MS), to: now };
    case "This Week": {
      const start = startOfDay(now);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
      return { from: start, to: now };
    }
    case "Last Week": {
      const start = startOfDay(now);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: start, to: endOfDay(end) };
    }
    case "This Month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "Last Month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default:
      return {};
  }
};

const SORT_PARAM: Record<SortableUserField, string> = {
  duration: "duration",
  monthlyUsage: "monthly",
  weeklyUsage: "weekly",
  dailyUsage: "daily",
};

type UsersQueryOptions = {
  page: number;
  limit: number;
  searchTerm: string;
  membershipFilter: string;
  statusFilter: string;
  timeframe: string;
  customDays: string;
  customFrom: string;
  customTo: string;
  sortField: SortableUserField;
  sortDir: "asc" | "desc";
};

const buildUsersQuery = (options: UsersQueryOptions): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(options.page));
  params.set("limit", String(options.limit));
  if (options.searchTerm.trim()) params.set("search", options.searchTerm.trim());
  if (options.membershipFilter !== "All Memberships") {
    params.set(
      "membership",
      options.membershipFilter === "No membership" ? "none" : options.membershipFilter,
    );
  }
  if (options.statusFilter !== "All") params.set("status", options.statusFilter.toLowerCase());
  const range = getUsageRange(
    options.timeframe,
    options.customDays,
    options.customFrom,
    options.customTo,
  );
  if (range.from) params.set("usageFrom", range.from.toISOString());
  if (range.to) params.set("usageTo", range.to.toISOString());
  params.set("sortBy", SORT_PARAM[options.sortField]);
  params.set("sortDir", options.sortDir);
  return params;
};

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
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<UsersResponse["meta"]>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = buildUsersQuery({
          page, limit, searchTerm, membershipFilter, statusFilter,
          timeframe, customDays, customFrom, customTo, sortField, sortDir,
        });
        const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Users request failed with ${response.status}`);
        }

        const data = (await response.json()) as UsersResponse;
        setUsers(Array.isArray(data.data) ? data.data.map(mapUser) : []);
        setPagination(data.meta);
        // The server clamps out-of-range pages; keep local state in sync.
        if (data.meta && data.meta.page !== page) setPage(data.meta.page);
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
  }, [page, limit, searchTerm, membershipFilter, statusFilter, timeframe, customDays, customFrom, customTo, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, membershipFilter, statusFilter, timeframe, customDays, customFrom, customTo, sortField, sortDir, limit]);

  // Load membership template names once so the filter lists all of them,
  // not just the ones present on the current page.
  const [membershipNames, setMembershipNames] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/memberships`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { name?: string }[];
        const names = (Array.isArray(data) ? data : [])
          .map((template) => template?.name)
          .filter(Boolean) as string[];
        setMembershipNames(Array.from(new Set(names)));
      } catch {
        /* fall back to names derived from loaded rows */
      }
    })();
    return () => controller.abort();
  }, []);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  };
  // Select-all operates on the current page; selections on other pages persist.
  const allOnPageSelected = users.length > 0 && users.every((u) => selectedUsers.includes(u.id));
  const toggleAll = () => {
    const pageIds = users.map((u) => u.id);
    setSelectedUsers((prev) =>
      allOnPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds])),
    );
  };

  const membershipOptions = useMemo(() => {
    const names = new Set([
      ...membershipNames,
      ...users.map((u) => u.membership).filter((m) => m && m !== "No membership"),
    ]);
    return ["All Memberships", ...Array.from(names), "No membership"];
  }, [membershipNames, users]);

  // Filtering and sorting both happen server-side across the full result set.
  const filteredUsers = users;

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
  // Prefer the server-side summary (all filtered users); fall back to the page sum.
  const totalMonthlyTokens =
    pagination?.summary?.monthlyTokens ??
    filteredUsers.reduce((s, u) => s + u.monthlyUsage, 0);
  const totalMonthlyInputTokens =
    pagination?.summary?.monthlyInputTokens ??
    filteredUsers.reduce((s, u) => s + u.monthlyInputUsage, 0);
  const totalMonthlyOutputTokens =
    pagination?.summary?.monthlyOutputTokens ??
    filteredUsers.reduce((s, u) => s + u.monthlyOutputUsage, 0);

  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const pageItems = useMemo<(number | "left-gap" | "right-gap")[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | "left-gap" | "right-gap")[] = [1];
    if (currentPage > 3) items.push("left-gap");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("right-gap");
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const exportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Walk every page with the current filters and sort so the export
      // covers the full result set, not just the visible page.
      const rows: UserRow[] = [];
      let exportPage = 1;
      for (;;) {
        const params = buildUsersQuery({
          page: exportPage, limit: 100, searchTerm, membershipFilter, statusFilter,
          timeframe, customDays, customFrom, customTo, sortField, sortDir,
        });
        const response = await fetch(`${API_BASE}/users?${params.toString()}`);
        if (!response.ok) throw new Error(`Export failed with ${response.status}`);
        const data = (await response.json()) as UsersResponse;
        rows.push(...(Array.isArray(data.data) ? data.data.map(mapUser) : []));
        if (!data.meta?.hasNextPage || exportPage >= 1000) break;
        exportPage += 1;
      }
      const escapeCell = (value: string | number) => {
        const text = String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const header = [
        "Email", "Assigned", "Membership", "Duration (days)", "Expiration",
        "Status", "Monthly Tokens", "Weekly Tokens", "Daily Tokens",
      ];
      const lines = [
        header.join(","),
        ...rows.map((u) =>
          [
            u.email, u.assigned.join("; "), u.membership, u.duration,
            u.expiration, u.status, u.monthlyUsage, u.weeklyUsage, u.dailyUsage,
          ].map(escapeCell).join(","),
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

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
              {formatTokensAsCost(totalMonthlyTokens, currency, totalMonthlyInputTokens, totalMonthlyOutputTokens)}
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
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="rounded border-white/20 bg-transparent text-sky-500 focus:ring-sky-500" />
                </th>
                <th className="px-4 py-4 font-semibold">User</th>
                <th className="px-4 py-4 font-semibold">Assigned</th>
                <th className="px-4 py-4 font-semibold">Membership</th>
                <th className={`px-4 py-4 font-semibold cursor-pointer hover:text-white transition select-none ${sortField === "duration" ? "text-white" : ""}`} onClick={() => handleSort("duration")}>
                  <span className="inline-flex items-center gap-1">
                    Duration
                    {sortField === "duration"
                      ? sortDir === "desc" ? <ChevronDown size={12} className="text-sky-400" /> : <ChevronUp size={12} className="text-sky-400" />
                      : <ChevronDown size={12} className="opacity-20" />}
                  </span>
                </th>
                <th className="px-4 py-4 font-semibold">Expiration</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className={`px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition select-none ${sortField === "monthlyUsage" ? "text-white" : ""}`} onClick={() => handleSort("monthlyUsage")}>
                  <span className="inline-flex items-center justify-end gap-1">
                    {usageColLabel("Monthly")}
                    {sortField === "monthlyUsage"
                      ? sortDir === "desc" ? <ChevronDown size={12} className="text-sky-400" /> : <ChevronUp size={12} className="text-sky-400" />
                      : <ChevronDown size={12} className="opacity-20" />}
                  </span>
                </th>
                <th className={`px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition select-none ${sortField === "weeklyUsage" ? "text-white" : ""}`} onClick={() => handleSort("weeklyUsage")}>
                  <span className="inline-flex items-center justify-end gap-1">
                    {usageColLabel("Weekly")}
                    {sortField === "weeklyUsage"
                      ? sortDir === "desc" ? <ChevronDown size={12} className="text-sky-400" /> : <ChevronUp size={12} className="text-sky-400" />
                      : <ChevronDown size={12} className="opacity-20" />}
                  </span>
                </th>
                <th className={`px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition select-none ${sortField === "dailyUsage" ? "text-white" : ""}`} onClick={() => handleSort("dailyUsage")}>
                  <span className="inline-flex items-center justify-end gap-1">
                    {usageColLabel("Daily")}
                    {sortField === "dailyUsage"
                      ? sortDir === "desc" ? <ChevronDown size={12} className="text-sky-400" /> : <ChevronUp size={12} className="text-sky-400" />
                      : <ChevronDown size={12} className="opacity-20" />}
                  </span>
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
                    {formatTokensAsCost(user.monthlyUsage, currency, user.monthlyInputUsage, user.monthlyOutputUsage)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sky-400/70">
                    {formatTokensAsCost(user.weeklyUsage, currency, user.weeklyInputUsage, user.weeklyOutputUsage)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sky-400/50">
                    {formatTokensAsCost(user.dailyUsage, currency, user.dailyInputUsage, user.dailyOutputUsage)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/40">
          <div className="flex items-center gap-3">
            <span>
              {totalUsers > 0
                ? `Showing ${(currentPage - 1) * limit + 1}-${(currentPage - 1) * limit + filteredUsers.length} of ${totalUsers} users`
                : "No users"}
            </span>
            <label className="flex items-center gap-1.5">
              Rows per page
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-md border border-white/10 bg-[#0F172A] px-1.5 py-1 text-white/60 outline-none hover:bg-white/5 transition"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                disabled={!pagination?.hasPreviousPage || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-md border border-white/10 px-2 py-1 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              {pageItems.map((item) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    disabled={isLoading}
                    onClick={() => setPage(item)}
                    className={`min-w-[28px] rounded-md border px-2 py-1 transition disabled:cursor-not-allowed ${
                      item === currentPage
                        ? "border-sky-500/40 bg-sky-500/15 font-semibold text-sky-400"
                        : "border-white/10 text-white/50 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className="px-1 text-white/30">…</span>
                ),
              )}
              <button
                disabled={!pagination?.hasNextPage || isLoading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-white/10 px-2 py-1 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <button
              onClick={exportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-white/50 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={13} /> {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
