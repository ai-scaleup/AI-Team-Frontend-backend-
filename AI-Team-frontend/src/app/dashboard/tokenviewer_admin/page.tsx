"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser, useAuth, UserButton } from "@clerk/nextjs"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Users,
  Loader2,
  ShieldAlert,
  Moon,
  Sun,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Key,
  Zap,
  Bot,
  Settings2,
  Check,
} from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ai-team-server.onrender.com"
const ADMIN_EMAIL = "digitalcoachai@gmail.com"

/* ─────────────────── Types ─────────────────── */

interface UserRecord {
  id: string
  email: string
  username: string | null
  oauthId: string
  createdAt: string
  updatedAt: string
}

interface TokenUsageRecord {
  id: string
  oauthId: string
  agentName: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  tokenLimit: number
  createdAt: string
  updatedAt: string
}

type SortField = "email" | "username" | "createdAt"
type SortDir = "asc" | "desc"

/* ─────────────────── Agent colours ─────────────────── */

const AGENT_COLORS: Record<string, { bar: string; badge: string }> = {
  JIM:          { bar: "bg-sky-500",     badge: "bg-sky-500/15 text-sky-400" },
  ALEX:         { bar: "bg-violet-500",  badge: "bg-violet-500/15 text-violet-400" },
  MIKE:         { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400" },
  TONY:         { bar: "bg-pink-500",    badge: "bg-pink-500/15 text-pink-400" },
  LARA:         { bar: "bg-cyan-500",    badge: "bg-cyan-500/15 text-cyan-400" },
  VALENTINA:    { bar: "bg-fuchsia-500", badge: "bg-fuchsia-500/15 text-fuchsia-400" },
  DANIELE:      { bar: "bg-purple-500",  badge: "bg-purple-500/15 text-purple-400" },
  SIMONE:       { bar: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-400" },
  NIKO:         { bar: "bg-teal-500",    badge: "bg-teal-500/15 text-teal-400" },
  ALADINO:      { bar: "bg-orange-500",  badge: "bg-orange-500/15 text-orange-400" },
  LAURA:        { bar: "bg-blue-500",    badge: "bg-blue-500/15 text-blue-400" },
  DAN:          { bar: "bg-lime-500",    badge: "bg-lime-500/15 text-lime-400" },
  MAX:          { bar: "bg-yellow-500",  badge: "bg-yellow-500/15 text-yellow-400" },
  SOFIA:        { bar: "bg-green-500",   badge: "bg-green-500/15 text-green-400" },
  ROBERTA:      { bar: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-400" },
  SARA_AI:      { bar: "bg-indigo-500",  badge: "bg-indigo-500/15 text-indigo-400" },
  JENNIFER_AI:  { bar: "bg-red-500",     badge: "bg-red-500/15 text-red-400" },
  CHIARA_AI:    { bar: "bg-sky-400",     badge: "bg-sky-400/15 text-sky-300" },
}

const DEFAULT_COLOR = { bar: "bg-slate-500", badge: "bg-slate-500/15 text-slate-400" }

const ALL_AGENTS = [
  "JIM","ALEX","MIKE","TONY","LARA","VALENTINA","DANIELE","SIMONE",
  "NIKO","ALADINO","LAURA","DAN","MAX","SOFIA","ROBERTA",
  "SARA_AI","JENNIFER_AI","CHIARA_AI",
]

function agentColor(name: string) {
  return AGENT_COLORS[name] ?? DEFAULT_COLOR
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return n.toString()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/* ─────────────────── Page ─────────────────── */

type ActiveTab = "tokenviewer" | "agent"

export default function TokenViewerAdminPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const [isDark, setIsDark] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("tokenviewer")

  const [users, setUsers] = useState<UserRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved) setIsDark(saved === "dark")
  }, [])
  useEffect(() => {
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  useEffect(() => {
    if (!isLoaded) return
    setIsAdmin(user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL)
  }, [user, isLoaded])

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/users`, { headers, cache: "no-store" })
      if (!res.ok) {
        const text = await res.text()
        setError(`Server error ${res.status}: ${text.slice(0, 120)}`)
        return
      }
      const data: UserRecord[] = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(`Failed to load users: ${err?.message ?? "Network error"}`)
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (isAdmin) fetchData()
    else if (isLoaded) setIsLoading(false)
  }, [isAdmin, isLoaded, fetchData])

  const filtered = users
    .filter((u) => {
      if (!search) return true
      const q = search.toLowerCase()
      return u.email.toLowerCase().includes(q) || (u.username?.toLowerCase().includes(q) ?? false)
    })
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1
      if (sortField === "email") return mul * a.email.localeCompare(b.email)
      if (sortField === "username")
        return mul * (a.username ?? "").localeCompare(b.username ?? "")
      return mul * a.createdAt.localeCompare(b.createdAt)
    })

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("desc") }
  }

  function exportCsv() {
    const header = ["#", "Email", "Username", "Joined"]
    const rows = filtered.map((u, i) => [
      i + 1,
      u.email,
      u.username ?? "",
      new Date(u.createdAt).toISOString().slice(0, 10),
    ])
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isLoaded || isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
        <p className={isDark ? "text-white/60" : "text-gray-600"}>You must be logged in.</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className={`flex min-h-screen items-center justify-center flex-col gap-4 ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Access Denied</h1>
        <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
          This page is restricted to administrators only.
        </p>
        <Link href="/dashboard" className="mt-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const bg   = isDark ? "bg-[#020617]" : "bg-gray-50"
  const card = isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"
  const text = isDark ? "text-white" : "text-gray-900"
  const muted = isDark ? "text-white/50" : "text-gray-500"
  const rowHover = isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"
  const divider = isDark ? "border-white/5" : "border-gray-100"

  return (
    <div className={`min-h-screen ${bg}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDark ? "bg-[#0B1221]/90 border-white/5" : "bg-white/90 border-gray-200"}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className={`text-xl font-bold ${text}`}>Token Viewer Admin</h1>
              <p className={`text-xs ${muted}`}>All registered users</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${isDark ? "border-white/10 text-white/60 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-600 hover:text-gray-900"}`}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => fetchData()}
              disabled={isRefreshing}
              className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <UserButton appearance={{ elements: { avatarBox: `h-8 w-8 ring-2 ${isDark ? "ring-white/10" : "ring-gray-200"}` } }} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Stat card */}
        <div className={`rounded-2xl border p-5 flex items-center gap-5 ${card}`}>
          <div className={`p-3 rounded-xl ${isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-100 text-sky-600"}`}>
            <Users size={24} />
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Total Registered Users</p>
            <p className={`text-4xl font-bold mt-0.5 ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              {isRefreshing
                ? <span className="inline-block h-9 w-16 animate-pulse rounded-md bg-sky-500/20" />
                : users.length.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-xl border ${isDark ? "bg-[#0F172A] border-white/5" : "bg-gray-100 border-gray-200"}`}>
          {(["tokenviewer", "agent"] as ActiveTab[]).map((tab) => {
            const isActive = activeTab === tab
            const label = tab === "tokenviewer" ? "Token Viewer" : "Agent"
            const Icon = tab === "tokenviewer" ? Key : Bot
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? isDark ? "bg-sky-500/20 text-sky-400 shadow-sm" : "bg-white text-sky-600 shadow-sm"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === "tokenviewer" && (
          <>
            {/* Search */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? "bg-[#0F172A] border-white/10" : "bg-white border-gray-200"}`}>
              <Search size={16} className={muted} />
              <input
                type="text"
                placeholder="Search by email or username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`flex-1 bg-transparent outline-none text-sm ${text}`}
              />
              {search && (
                <button onClick={() => setSearch("")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-700"}`}>
                  Clear
                </button>
              )}
            </div>

            {/* Table */}
            <div className={`rounded-2xl border overflow-hidden ${card}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${divider}`}>
                    <th className={`px-4 py-3 text-left font-semibold w-12 ${muted}`}>#</th>
                    <SortHeader label="Email" field="email" current={sortField} dir={sortDir} onSort={toggleSort} isDark={isDark} />
                    <SortHeader label="Username" field="username" current={sortField} dir={sortDir} onSort={toggleSort} isDark={isDark} />
                    <SortHeader label="Joined" field="createdAt" current={sortField} dir={sortDir} onSort={toggleSort} isDark={isDark} />
                  </tr>
                </thead>
                <tbody>
                  {isRefreshing
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className={`border-b ${divider}`}>
                          {[1, 2, 3, 4].map((c) => (
                            <td key={c} className="px-4 py-3">
                              <div className={`h-4 rounded animate-pulse ${isDark ? "bg-white/5" : "bg-gray-200"}`} style={{ width: `${[20, 60, 40, 30][c - 1]}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className={`text-center py-16 ${muted}`}>
                          {search ? `No users match "${search}".` : "No users found."}
                        </td>
                      </tr>
                    )
                    : filtered.map((u, idx) => (
                        <tr key={u.id} className={`border-b last:border-0 transition-colors ${divider} ${rowHover}`}>
                          <td className={`px-4 py-3 text-xs font-mono ${muted}`}>{idx + 1}</td>
                          <td
                            className={`px-4 py-3 font-medium cursor-pointer transition-colors ${text} hover:text-sky-400`}
                            onClick={() => setSelectedUser(u)}
                          >
                            {u.email}
                          </td>
                          <td className={`px-4 py-3 ${muted}`}>{u.username ?? "—"}</td>
                          <td className={`px-4 py-3 text-xs ${muted}`}>{formatDate(u.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>

              {!isRefreshing && filtered.length > 0 && (
                <div className={`px-4 py-2.5 border-t text-xs ${muted} ${divider}`}>
                  Showing {filtered.length.toLocaleString("en-US")}
                  {filtered.length !== users.length ? ` of ${users.length.toLocaleString("en-US")} users` : ` user${filtered.length !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "agent" && (
          <AgentTab users={users} isRefreshing={isRefreshing} isDark={isDark} card={card} text={text} muted={muted} getToken={getToken} />
        )}
      </main>

      {/* User Detail Sidebar */}
      <UserSidebar
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        isDark={isDark}
        getToken={getToken}
      />
    </div>
  )
}

/* ─────────────────── Agent Tab ─────────────────── */

function AgentTab({
  users, isRefreshing, isDark, card, text, muted, getToken,
}: {
  users: UserRecord[]
  isRefreshing: boolean
  isDark: boolean
  card: string
  text: string
  muted: string
  getToken: () => Promise<string | null>
}) {
  const [allUsage, setAllUsage] = useState<TokenUsageRecord[]>([])
  const [fetching, setFetching] = useState(false)
  const [modalAgent, setModalAgent] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setFetching(true)
      try {
        const token = await getToken()
        const headers: Record<string, string> = {}
        if (token) headers["Authorization"] = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/token-usage`, { headers, cache: "no-store" })
        if (res.ok) {
          const data: TokenUsageRecord[] = await res.json()
          setAllUsage(Array.isArray(data) ? data : [])
        }
      } catch { /* silently fail */ }
      setFetching(false)
    }
    load()
  }, [getToken])

  const agentMap: Record<string, { inputTokens: number; outputTokens: number }> = {}
  for (const r of allUsage) {
    if (!agentMap[r.agentName]) agentMap[r.agentName] = { inputTokens: 0, outputTokens: 0 }
    agentMap[r.agentName].inputTokens += r.inputTokens
    agentMap[r.agentName].outputTokens += r.outputTokens
  }

  const agentTotals = ALL_AGENTS.map((agent) => {
    const v = agentMap[agent] ?? { inputTokens: 0, outputTokens: 0 }
    return {
      agent,
      inputTokens: v.inputTokens,
      outputTokens: v.outputTokens,
      total: v.inputTokens + v.outputTokens,
      color: agentColor(agent),
    }
  }).sort((a, b) => b.total - a.total)

  const maxTotal = Math.max(...agentTotals.map((a) => a.total), 1)

  if (isRefreshing || fetching) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`rounded-2xl border p-4 animate-pulse ${card}`}>
            <div className={`h-4 w-32 rounded ${isDark ? "bg-white/5" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <p className={`text-xs ${muted}`}>
          Aggregate token usage per agent across all {users.length} registered users.
        </p>
        {agentTotals.map((a, rank) => {
          const pct = (a.total / maxTotal) * 100
          const inputPct = a.total > 0 ? (a.inputTokens / a.total) * 100 : 50
          return (
            <div key={a.agent} className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono w-5 text-right ${muted}`}>#{rank + 1}</span>
                  <div className={`p-1.5 rounded-lg ${a.color.badge}`}><Bot size={14} /></div>
                  <span className={`text-sm font-bold ${text}`}>{a.agent}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.color.badge}`}>
                    {formatTokenCount(a.total)}
                  </span>
                  <button
                    onClick={() => setModalAgent(a.agent)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      isDark
                        ? "border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5"
                        : "border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    <Settings2 size={12} />
                    Set Limit
                  </button>
                </div>
              </div>

              <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-gray-200"}`}>
                <div className="h-full rounded-full flex transition-all duration-500" style={{ width: `${pct}%` }}>
                  <div className={`h-full ${a.color.bar}`} style={{ width: `${inputPct}%` }} />
                  <div className={`h-full ${a.color.bar} opacity-40`} style={{ width: `${100 - inputPct}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] ${muted}`}>In: <span className={`font-semibold ${text}`}>{formatTokenCount(a.inputTokens)}</span></span>
                <span className={`text-[10px] ${muted}`}>Out: <span className={`font-semibold ${text}`}>{formatTokenCount(a.outputTokens)}</span></span>
              </div>
            </div>
          )
        })}
      </div>

      {modalAgent && (
        <LimitModal
          agent={modalAgent}
          users={users}
          usageRecords={allUsage.filter((r) => r.agentName === modalAgent)}
          isDark={isDark}
          getToken={getToken}
          onClose={() => setModalAgent(null)}
        />
      )}
    </>
  )
}

/* ─────────────────── Limit Modal ─────────────────── */

function LimitModal({
  agent, users, usageRecords, isDark, getToken, onClose,
}: {
  agent: string
  users: UserRecord[]
  usageRecords: TokenUsageRecord[]
  isDark: boolean
  getToken: () => Promise<string | null>
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [editingOauth, setEditingOauth] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState("")
  const [saved, setSaved] = useState<string | null>(null)
  const [bulkVal, setBulkVal] = useState("")
  const [bulkApplied, setBulkApplied] = useState(false)
  const [saving, setSaving] = useState(false)

  const overlay  = isDark ? "bg-black/60" : "bg-black/30"
  const panelBg  = isDark ? "bg-[#0F172A]" : "bg-white"
  const borderClr = isDark ? "border-white/10" : "border-gray-200"
  const text      = isDark ? "text-white" : "text-gray-900"
  const muted     = isDark ? "text-white/50" : "text-gray-500"
  const inputBg   = isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
  const rowHover  = isDark ? "hover:bg-white/[0.04]" : "hover:bg-gray-50"

  const existingByOauth = Object.fromEntries(usageRecords.map((r) => [r.oauthId, r.tokenLimit]))

  async function patchLimit(oauthId: string, tokenLimit: number) {
    setSaving(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      await fetch(`${API_BASE}/token-usage/${oauthId}/${agent}/limit`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ tokenLimit }),
      })
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function applyBulk() {
    const n = parseInt(bulkVal.replace(/[^0-9]/g, ""), 10)
    if (isNaN(n) || n <= 0) return
    await Promise.all(users.map((u) => patchLimit(u.oauthId, n)))
    setBulkApplied(true)
    setBulkVal("")
    setTimeout(() => setBulkApplied(false), 2000)
  }

  async function commitEdit(oauthId: string) {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ""), 10)
    if (!isNaN(n) && n > 0) {
      await patchLimit(oauthId, n)
      setSaved(oauthId)
      setTimeout(() => setSaved(null), 1500)
    }
    setEditingOauth(null)
    setInputVal("")
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return false
    const q = search.toLowerCase()
    return u.email.toLowerCase().includes(q) || (u.username?.toLowerCase().includes(q) ?? false)
  }).slice(0, 8)

  const color = agentColor(agent)

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${overlay}`} onClick={onClose}>
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl ${panelBg} ${borderClr}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderClr}`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${color.badge}`}><Bot size={16} /></div>
            <div>
              <h3 className={`text-sm font-bold ${text}`}>{agent} — Token Limits</h3>
              <p className={`text-xs ${muted}`}>Set per-user token cap for this agent</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/50 hover:text-white" : "hover:bg-gray-100 text-gray-500"}`}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Bulk */}
          <div className={`rounded-xl border p-3.5 ${isDark ? "bg-sky-500/5 border-sky-500/20" : "bg-sky-50 border-sky-200"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              Set limit for ALL {users.length} users
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={bulkVal}
                onChange={(e) => setBulkVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyBulk() }}
                placeholder="e.g. 50000 tokens"
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none ${inputBg}`}
              />
              <button
                onClick={applyBulk}
                disabled={!bulkVal.trim() || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
              >
                {bulkApplied ? <Check size={13} /> : <Users size={13} />}
                {bulkApplied ? "Applied!" : "Apply to All"}
              </button>
            </div>
          </div>

          {/* Search user */}
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? "bg-[#0B1221] border-white/10" : "bg-gray-50 border-gray-200"}`}>
            <Search size={14} className={muted} />
            <input
              autoFocus
              type="text"
              placeholder="Search user by email or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 bg-transparent outline-none text-sm ${text}`}
            />
            {search && (
              <button onClick={() => setSearch("")} className={`text-xs ${muted} hover:opacity-80`}>
                <X size={12} />
              </button>
            )}
          </div>

          {search && (
            <div className={`rounded-xl border overflow-hidden ${borderClr} ${isDark ? "bg-[#0B1221]" : "bg-gray-50"}`}>
              {filteredUsers.length === 0
                ? <p className={`text-xs text-center py-4 ${muted}`}>No users found.</p>
                : filteredUsers.map((u) => {
                    const currentLimit = existingByOauth[u.oauthId]
                    const isEditing = editingOauth === u.oauthId
                    const wasSaved = saved === u.oauthId
                    return (
                      <div key={u.oauthId} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 ${borderClr} ${rowHover} transition-colors`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${text}`}>{u.email}</p>
                          {currentLimit !== undefined && !isEditing && (
                            <p className={`text-[10px] mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                              Limit: {formatTokenCount(currentLimit)}
                            </p>
                          )}
                        </div>

                        {isEditing
                          ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                autoFocus
                                type="text"
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEdit(u.oauthId)
                                  if (e.key === "Escape") setEditingOauth(null)
                                }}
                                placeholder="e.g. 50000"
                                className={`w-28 px-2 py-1 rounded-lg border text-xs outline-none ${inputBg}`}
                              />
                              <button onClick={() => commitEdit(u.oauthId)} className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white transition-colors">
                                <Check size={12} />
                              </button>
                              <button onClick={() => setEditingOauth(null)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/40" : "hover:bg-gray-200 text-gray-400"}`}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {wasSaved && <span className={`text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Saved!</span>}
                              <button
                                onClick={() => { setEditingOauth(u.oauthId); setInputVal(currentLimit?.toString() ?? "") }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${isDark ? "border-white/10 text-white/50 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-500 hover:text-gray-800"}`}
                              >
                                {currentLimit !== undefined ? "Edit" : "Set"}
                              </button>
                            </div>
                          )}
                      </div>
                    )
                  })}
            </div>
          )}

          {/* Existing limits */}
          {usageRecords.filter((r) => r.tokenLimit !== 100000).length > 0 && (
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${muted}`}>
                Custom Limits ({usageRecords.filter((r) => r.tokenLimit !== 100000).length})
              </p>
              <div className={`rounded-xl border overflow-hidden ${borderClr}`}>
                {usageRecords
                  .filter((r) => r.tokenLimit !== 100000)
                  .map((r) => {
                    const u = users.find((u) => u.oauthId === r.oauthId)
                    return (
                      <div key={r.oauthId} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 ${borderClr} ${isDark ? "bg-amber-500/5" : "bg-amber-50/50"}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${text}`}>{u?.email ?? r.oauthId}</p>
                          <p className={`text-[10px] mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                            Limit: {formatTokenCount(r.tokenLimit)} tokens
                          </p>
                        </div>
                        <button
                          onClick={() => { setSearch(u?.email ?? ""); setEditingOauth(r.oauthId); setInputVal(r.tokenLimit.toString()) }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${isDark ? "border-white/10 text-white/50 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-500 hover:text-gray-800"}`}
                        >
                          Edit
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {!search && usageRecords.length === 0 && (
            <p className={`text-xs text-center py-4 ${muted}`}>No limits set yet. Search for a user above to get started.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Sort Header ─────────────────── */

function SortHeader({ label, field, current, dir, onSort, isDark }: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (f: SortField) => void
  isDark: boolean
}) {
  const active = current === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-left font-semibold cursor-pointer select-none transition-colors ${
        active
          ? isDark ? "text-sky-400" : "text-blue-600"
          : isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null}
      </span>
    </th>
  )
}

/* ─────────────────── User Detail Sidebar ─────────────────── */

function UserSidebar({ user, onClose, isDark, getToken }: {
  user: UserRecord | null
  onClose: () => void
  isDark: boolean
  getToken: () => Promise<string | null>
}) {
  const isOpen = !!user
  const overlay  = isDark ? "bg-black/50" : "bg-black/30"
  const panelBg  = isDark ? "bg-[#0F172A]" : "bg-white"
  const borderClr = isDark ? "border-white/10" : "border-gray-200"
  const text      = isDark ? "text-white" : "text-gray-900"
  const muted     = isDark ? "text-white/50" : "text-gray-500"
  const fieldBg   = isDark ? "bg-white/5" : "bg-gray-50"

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? `${overlay} opacity-100` : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-full max-w-xl border-l shadow-2xl transition-transform duration-300 ease-in-out ${panelBg} ${borderClr} ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {user && (
          <div className="flex flex-col h-full">
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderClr}`}>
              <h2 className={`text-lg font-bold ${text}`}>User Details</h2>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <TokenUsageSection
                oauthId={user.oauthId}
                isDark={isDark}
                text={text}
                muted={muted}
                fieldBg={fieldBg}
                borderClr={borderClr}
                getToken={getToken}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────── Token Usage Section ─────────────────── */

function TokenUsageSection({ oauthId, isDark, text, muted, fieldBg, borderClr, getToken }: {
  oauthId: string
  isDark: boolean
  text: string
  muted: string
  fieldBg: string
  borderClr: string
  getToken: () => Promise<string | null>
}) {
  const [usage, setUsage] = useState<TokenUsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [limitInput, setLimitInput] = useState("")
  const [savedAgent, setSavedAgent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function patchLimit(agentName: string, tokenLimit: number) {
    setSaving(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      await fetch(`${API_BASE}/token-usage/${oauthId}/${agentName}/limit`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ tokenLimit }),
      })
      setUsage((prev) => {
        const exists = prev.some((r) => r.agentName === agentName)
        if (exists) return prev.map((r) => r.agentName === agentName ? { ...r, tokenLimit } : r)
        return [...prev, { id: "", oauthId, agentName, inputTokens: 0, outputTokens: 0, totalTokens: 0, tokenLimit, createdAt: "", updatedAt: "" }]
      })
      setSavedAgent(agentName)
      setTimeout(() => setSavedAgent(null), 1500)
    } catch { /* ignore */ }
    setSaving(false)
    setEditingAgent(null)
    setLimitInput("")
  }

  function commitEdit(agentName: string) {
    const n = parseInt(limitInput.replace(/[^0-9]/g, ""), 10)
    if (!isNaN(n) && n > 0) patchLimit(agentName, n)
    else { setEditingAgent(null); setLimitInput("") }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const token = await getToken()
        const headers: Record<string, string> = {}
        if (token) headers["Authorization"] = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/token-usage/${oauthId}`, { headers, cache: "no-store" })
        if (res.ok) {
          const data: TokenUsageRecord[] = await res.json()
          setUsage(Array.isArray(data) ? data.sort((a, b) => b.totalTokens - a.totalTokens) : [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [oauthId, getToken])

  const totalInput  = usage.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = usage.reduce((s, r) => s + r.outputTokens, 0)
  const totalTokens = totalInput + totalOutput

  const usageByAgent = Object.fromEntries(usage.map((r) => [r.agentName, r]))
  const hasRecordSet = new Set(usage.map((r) => r.agentName))
  const allRows: TokenUsageRecord[] = ALL_AGENTS.map((name) =>
    usageByAgent[name] ?? {
      id: "", oauthId, agentName: name,
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      tokenLimit: 100000, createdAt: "", updatedAt: "",
    }
  ).sort((a, b) => b.totalTokens - a.totalTokens)

  const maxAgentTotal = Math.max(...allRows.map((r) => r.totalTokens), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className={`flex items-center gap-2 ${muted}`}>
        <Zap size={16} />
        <span className="text-xs font-semibold uppercase tracking-wider">Token Usage by Agent</span>
      </div>

      {/* Total summary */}
      <div className={`rounded-xl p-4 border ${borderClr} ${isDark ? "bg-gradient-to-br from-sky-500/10 via-violet-500/5 to-transparent" : "bg-gradient-to-br from-sky-50 via-violet-50 to-transparent"}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Total Usage</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-sky-500/15 text-sky-400" : "bg-sky-100 text-sky-600"}`}>
            {formatTokenCount(totalTokens)} tokens
          </span>
        </div>
        <div className="flex gap-6">
          <div>
            <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${muted}`}>Input</p>
            <p className={`text-lg font-bold ${isDark ? "text-sky-400" : "text-sky-600"}`}>{formatTokenCount(totalInput)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${muted}`}>Output</p>
            <p className={`text-lg font-bold ${isDark ? "text-violet-400" : "text-violet-600"}`}>{formatTokenCount(totalOutput)}</p>
          </div>
        </div>
      </div>

      {/* Per-agent breakdown */}
      <div className="space-y-2">
            {allRows.map((r) => {
              const color = agentColor(r.agentName)
              const pct = (r.totalTokens / maxAgentTotal) * 100
              const inputPct = r.totalTokens > 0 ? (r.inputTokens / r.totalTokens) * 100 : 50
              const limitPct = r.tokenLimit > 0 ? Math.min((r.totalTokens / r.tokenLimit) * 100, 100) : 0
              return (
                <div key={r.agentName} className={`rounded-xl p-3.5 ${fieldBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md ${color.badge}`}><Bot size={12} /></div>
                      <span className={`text-xs font-semibold ${text}`}>{r.agentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {limitPct >= 80 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${limitPct >= 100 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
                          {limitPct >= 100 ? "Limit reached" : `${Math.round(limitPct)}% of limit`}
                        </span>
                      )}
                      <span className={`text-[11px] font-mono font-semibold ${muted}`}>{formatTokenCount(r.totalTokens)}</span>
                    </div>
                  </div>

                  {/* Usage bar */}
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-gray-200"}`}>
                    <div className="h-full rounded-full flex transition-all duration-500" style={{ width: `${pct}%` }}>
                      <div className={`h-full ${color.bar}`} style={{ width: `${inputPct}%` }} />
                      <div className={`h-full ${color.bar} opacity-40`} style={{ width: `${100 - inputPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[10px] ${muted}`}>In: <span className={`font-semibold ${text}`}>{formatTokenCount(r.inputTokens)}</span></span>

                    {editingAgent === r.agentName ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={limitInput}
                          onChange={(e) => setLimitInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(r.agentName)
                            if (e.key === "Escape") { setEditingAgent(null); setLimitInput("") }
                          }}
                          placeholder="e.g. 50000"
                          className={`w-24 px-1.5 py-0.5 rounded border text-[10px] outline-none ${isDark ? "bg-white/10 border-white/20 text-white placeholder:text-white/30" : "bg-gray-100 border-gray-300 text-gray-900"}`}
                        />
                        <button
                          onClick={() => commitEdit(r.agentName)}
                          disabled={saving}
                          className="p-0.5 rounded bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-40 transition-colors"
                        >
                          <Check size={10} />
                        </button>
                        <button
                          onClick={() => { setEditingAgent(null); setLimitInput("") }}
                          className={`p-0.5 rounded transition-colors ${isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-gray-200 text-gray-400"}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {savedAgent === r.agentName
                          ? <span className={`text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Saved!</span>
                          : hasRecordSet.has(r.agentName)
                            ? <span className={`text-[10px] ${muted}`}>
                                Limit: <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-500"}`}>{formatTokenCount(r.tokenLimit)}</span>
                              </span>
                            : <span className={`text-[10px] ${isDark ? "text-white/25" : "text-gray-300"}`}>No limit set</span>
                        }
                        <button
                          onClick={() => { setEditingAgent(r.agentName); setLimitInput(hasRecordSet.has(r.agentName) ? r.tokenLimit.toString() : "") }}
                          title="Set token limit"
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${isDark ? "border-white/10 text-white/40 hover:text-sky-400 hover:border-sky-500/40 hover:bg-sky-500/10" : "border-gray-200 text-gray-400 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50"}`}
                        >
                          <Settings2 size={9} />
                          {hasRecordSet.has(r.agentName) ? "Edit" : "Set"}
                        </button>
                      </div>
                    )}

                    <span className={`text-[10px] ${muted}`}>Out: <span className={`font-semibold ${text}`}>{formatTokenCount(r.outputTokens)}</span></span>
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
