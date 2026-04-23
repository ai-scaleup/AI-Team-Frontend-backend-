"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Filter, Calendar, MoreVertical, Edit2, Trash2,
  ChevronDown, Users, Download, CreditCard, Clock, X
} from "lucide-react";

/* ──────────────────────────── MOCK DATA ──────────────────────────── */

const MOCK_USERS = [
  { id: "101", name: "Mario Rossi", email: "mario@example.com", assigned: ["SARA_AI", "JIM"], membership: "1 year Sara AI", duration: 365, expiration: "2024-10-01", monthlyUsage: 145200, weeklyUsage: 32400, status: "active" },
  { id: "102", name: "Luigi Verdi", email: "luigi@example.com", assigned: ["Marketing Powerhouse"], membership: "3 months Ai Team", duration: 90, expiration: "2023-12-15", monthlyUsage: 98700, weeklyUsage: 21300, status: "active" },
  { id: "103", name: "Anna Neri", email: "anna@example.com", assigned: ["CHIARA_AI"], membership: "Starter Bundle", duration: 30, expiration: "2023-11-01", monthlyUsage: 76400, weeklyUsage: 18200, status: "expiring" },
  { id: "104", name: "Paolo Gialli", email: "paolo@example.com", assigned: ["Sales Closers"], membership: "1 year Ai Team", duration: 365, expiration: "2024-05-20", monthlyUsage: 45600, weeklyUsage: 10800, status: "active" },
  { id: "105", name: "Giulia Bianchi", email: "giulia@example.com", assigned: ["JENNIFER_AI"], membership: "6 months Jennifer AI", duration: 180, expiration: "2024-03-30", monthlyUsage: 112500, weeklyUsage: 28600, status: "active" },
  { id: "106", name: "Luca Moretti", email: "luca@example.com", assigned: ["SARA_AI", "ALEX"], membership: "1 year Sara AI", duration: 365, expiration: "2024-08-12", monthlyUsage: 67300, weeklyUsage: 15200, status: "active" },
  { id: "107", name: "Sofia Romano", email: "sofia@example.com", assigned: ["JENNIFER_AI", "MIKE"], membership: "3 months Ai Team", duration: 90, expiration: "2023-11-30", monthlyUsage: 87200, weeklyUsage: 19800, status: "expiring" },
  { id: "108", name: "Andrea Colombo", email: "andrea@example.com", assigned: ["Content Creators"], membership: "Starter Bundle", duration: 30, expiration: "2023-10-28", monthlyUsage: 54300, weeklyUsage: 12100, status: "expired" },
  { id: "109", name: "Elena Conti", email: "elena@example.com", assigned: ["SARA_AI"], membership: "1 year Sara AI", duration: 365, expiration: "2024-11-15", monthlyUsage: 45800, weeklyUsage: 9600, status: "active" },
  { id: "110", name: "Marco Ferraro", email: "marco@example.com", assigned: ["JIM", "ALEX", "TONY"], membership: "1 year Ai Team", duration: 365, expiration: "2024-06-01", monthlyUsage: 32100, weeklyUsage: 7400, status: "active" },
  { id: "111", name: "Chiara Ricci", email: "chiara@example.com", assigned: ["CHIARA_AI", "LARA"], membership: "3 months Ai Team", duration: 90, expiration: "2024-01-10", monthlyUsage: 38700, weeklyUsage: 8900, status: "active" },
  { id: "112", name: "Francesco Mancini", email: "francesco@example.com", assigned: ["Customer Support Tier 1"], membership: "Starter Bundle", duration: 30, expiration: "2023-11-05", monthlyUsage: 65200, weeklyUsage: 14300, status: "expiring" },
  { id: "113", name: "Valentina Costa", email: "valentina@example.com", assigned: ["VALENTINA", "DANIELE"], membership: "6 months Jennifer AI", duration: 180, expiration: "2024-04-20", monthlyUsage: 43100, weeklyUsage: 9100, status: "active" },
  { id: "114", name: "Davide Galli", email: "davide@example.com", assigned: ["JENNIFER_AI"], membership: "Starter Bundle", duration: 30, expiration: "2023-10-25", monthlyUsage: 21900, weeklyUsage: 4800, status: "expired" },
  { id: "115", name: "Roberto Esposito", email: "roberto@example.com", assigned: ["CHIARA_AI", "SARA_AI"], membership: "1 year Ai Team", duration: 365, expiration: "2024-09-18", monthlyUsage: 29800, weeklyUsage: 6200, status: "active" },
];

const TIMEFRAME_PRESETS = [
  "Today", "Yesterday", "Last 7 Days", "This Week", "Last Week",
  "This Month", "Last Month"
];

const MEMBERSHIP_OPTIONS = [
  "All Memberships", "1 year Sara AI", "3 months Ai Team", "Starter Bundle",
  "1 year Ai Team", "6 months Jennifer AI"
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
  const [sortField, setSortField] = useState<string>("monthlyUsage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    if (selectedUsers.length === filteredUsers.length) setSelectedUsers([]);
    else setSelectedUsers(filteredUsers.map((u) => u.id));
  };

  const filteredUsers = MOCK_USERS
    .filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.assigned.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.membership.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMembership = membershipFilter === "All Memberships" || u.membership === membershipFilter;
      const matchesStatus = statusFilter === "All" || u.status === statusFilter.toLowerCase();
      return matchesSearch && matchesMembership && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      }
      return 0;
    });

  const handleSort = (field: string) => {
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

  // Summary stats
  const totalUsers = filteredUsers.length;
  const activeUsers = filteredUsers.filter((u) => u.status === "active").length;
  const totalMonthlyTokens = filteredUsers.reduce((s, u) => s + u.monthlyUsage, 0);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">All Users</h1>
        <p className="text-sm text-white/50">Manage user accounts, assignments, and token usage</p>
      </div>

      {/* ──────── SUMMARY CARDS ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Active</p>
            <p className="text-xl font-bold text-emerald-400">{activeUsers} <span className="text-xs text-white/30 font-normal">/ {totalUsers}</span></p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Total Monthly Tokens</p>
            <p className="text-xl font-bold font-mono text-sky-400">{(totalMonthlyTokens / 1000).toFixed(0)}k</p>
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
            {MEMBERSHIP_OPTIONS.map((m) => <option key={m}>{m}</option>)}
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
                  Monthly Usage {sortField === "monthlyUsage" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4 font-semibold text-right cursor-pointer hover:text-white transition" onClick={() => handleSort("weeklyUsage")}>
                  Weekly Usage {sortField === "weeklyUsage" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
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
                      <span className="font-medium text-white">{user.name}</span>
                      <span className="text-[11px] text-white/40">{user.email}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {user.assigned.map((a) => (
                        <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                      ))}
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
                  <td className="px-4 py-4 text-right font-mono text-sky-300">{(user.monthlyUsage / 1000).toFixed(1)}k</td>
                  <td className="px-4 py-4 text-right font-mono text-sky-400/70">{(user.weeklyUsage / 1000).toFixed(1)}k</td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-white/30 hover:text-white transition opacity-0 group-hover:opacity-100"><MoreVertical size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-white/40">No users found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/40">
          <span>Showing {filteredUsers.length} of {MOCK_USERS.length} users</span>
          <button className="flex items-center gap-1.5 text-white/50 hover:text-white transition">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
