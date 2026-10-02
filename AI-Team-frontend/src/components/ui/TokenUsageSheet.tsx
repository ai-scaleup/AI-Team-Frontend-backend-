"use client"

import { useCallback, useMemo, useState } from "react"
import { BarChart3, Coins, RefreshCw, TriangleAlert } from "lucide-react"

import { agents } from "@/lib/agentCatalog"
import { authenticatedFetch } from "@/lib/authenticatedFetch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { API_BASE } from "@/lib/apiBase"

type TokenUsage = {
  agentName: string
  totalTokenLimit: number
  totalUsedTokens: number
  totalTokensLeft: number
  totalUsedInputTokens: number
  totalUsedOutputTokens: number
}

type TokenUsageSheetProps = {
  email: string
  assignedAgentNames: string[]
  theme: "light" | "dark"
}

const numberFormatter = new Intl.NumberFormat("it-IT")

const agentColors = ["#38bdf8", "#a78bfa", "#2dd4bf", "#fb7185", "#fbbf24", "#818cf8"]

const asCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export default function TokenUsageSheet({ email, assignedAgentNames, theme }: TokenUsageSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [usage, setUsage] = useState<TokenUsage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsage = useCallback(async () => {
    if (!email || !API_BASE) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await authenticatedFetch(`${API_BASE}/token-usage/${encodeURIComponent(email)}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Token usage request failed with ${response.status}`)
      }

      const payload = await response.json()
      setUsage(Array.isArray(payload) ? payload : [])
    } catch (requestError) {
      console.error("Unable to load token usage", requestError)
      setError("Non è stato possibile caricare l'utilizzo dei token.")
    } finally {
      setIsLoading(false)
    }
  }, [email])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) void loadUsage()
  }

  const rows = useMemo(() => {
    const usageByAgent = new Map(usage.map((item) => [item.agentName, item]))
    const agentNames = new Set([...assignedAgentNames, ...usage.map((item) => item.agentName)])

    return Array.from(agentNames)
      .filter((agentName) => !agentName.startsWith("TEST_"))
      .map((agentName, index) => {
        const record = usageByAgent.get(agentName)
        const limit = asCount(record?.totalTokenLimit)
        const used = asCount(record?.totalUsedTokens)
        const tokensLeft = record ? Math.max(0, asCount(record.totalTokensLeft)) : limit
        const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
        const agent = agents.find((item) => item.key === agentName)

        return {
          agentName,
          displayName: agent?.name ?? agentName.replaceAll("_", " "),
          role: agent?.role ?? "AI Agent",
          limit,
          used,
          tokensLeft,
          input: asCount(record?.totalUsedInputTokens),
          output: asCount(record?.totalUsedOutputTokens),
          percent,
          color: agentColors[index % agentColors.length],
        }
      })
      .sort((a, b) => b.used - a.used || a.displayName.localeCompare(b.displayName))
  }, [assignedAgentNames, usage])

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          limit: sum.limit + row.limit,
          used: sum.used + row.used,
          left: sum.left + row.tokensLeft,
        }),
        { limit: 0, used: 0, left: 0 },
      ),
    [rows],
  )

  const totalPercent = totals.limit > 0 ? Math.min(100, (totals.used / totals.limit) * 100) : 0
  const dark = theme === "dark"

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${
            dark
              ? "border-cyan-400/20 bg-cyan-400/5 text-cyan-300 hover:border-cyan-300/50 hover:bg-cyan-400/10"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100"
          }`}
          title="Visualizza utilizzo token"
          aria-label="Visualizza utilizzo token"
        >
          <Coins className="h-4 w-4" />
          <span className="hidden lg:inline">TOKEN</span>
        </button>
      </SheetTrigger>

      <SheetContent
        className={`w-[min(94vw,460px)] gap-0 overflow-hidden border-l p-0 sm:max-w-[460px] ${
          dark
            ? "border-cyan-400/15 bg-[#050b18] text-white"
            : "border-blue-100 bg-slate-50 text-slate-950"
        }`}
      >
        <SheetHeader className={`border-b px-6 pb-5 pt-6 ${dark ? "border-white/10" : "border-slate-200"}`}>
          <div className="flex items-center gap-2 text-cyan-400">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Token monitor</span>
          </div>
          <SheetTitle className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-950"}`}>
            Utilizzo token
          </SheetTitle>
          <SheetDescription className={dark ? "text-slate-400" : "text-slate-500"}>
            Consumo complessivo e dettaglio dei tuoi agenti AI.
          </SheetDescription>
        </SheetHeader>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          <section className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  Token disponibili
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-400">
                  {numberFormatter.format(totals.left)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadUsage()}
                disabled={isLoading}
                className={`rounded-lg border p-2 transition-colors disabled:opacity-50 ${
                  dark ? "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                aria-label="Aggiorna utilizzo token"
                title="Aggiorna"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className={`mt-4 h-2 overflow-hidden rounded-full ${dark ? "bg-white/[0.07]" : "bg-slate-100"}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-[width] duration-500"
                style={{ width: `${totalPercent}%` }}
              />
            </div>
            <div className={`mt-2 flex justify-between text-[11px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
              <span>{numberFormatter.format(totals.used)} utilizzati</span>
              <span>{totals.limit ? `${totalPercent.toFixed(1)}% di ${numberFormatter.format(totals.limit)}` : "Limite non disponibile"}</span>
            </div>
          </section>

          {error && (
            <div className="mt-4 flex gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-slate-300" : "text-slate-600"}`}>
              Agenti
            </h3>
            <span className={`rounded-md px-2 py-0.5 text-[10px] ${dark ? "bg-white/5 text-slate-400" : "bg-slate-200 text-slate-600"}`}>
              {rows.length}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {isLoading && rows.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={`h-32 animate-pulse rounded-2xl ${dark ? "bg-white/5" : "bg-slate-200"}`} />
              ))
            ) : rows.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-8 text-center text-sm ${dark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-500"}`}>
                Nessun dato di utilizzo disponibile.
              </div>
            ) : (
              rows.map((row) => (
                <article
                  key={row.agentName}
                  className={`rounded-2xl border p-4 ${dark ? "border-white/[0.08] bg-white/[0.025]" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color, boxShadow: `0 0 12px ${row.color}` }} />
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-bold ${dark ? "text-white" : "text-slate-900"}`}>{row.displayName}</p>
                        <p className={`truncate text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>{row.role}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-emerald-400">{numberFormatter.format(row.tokensLeft)}</p>
                      <p className={`text-[9px] uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>rimasti</p>
                    </div>
                  </div>

                  <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/[0.07]" : "bg-slate-100"}`}>
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${row.percent}%`, backgroundColor: row.color }} />
                  </div>
                  <div className={`mt-2 flex justify-between text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    <span>{numberFormatter.format(row.used)} usati</span>
                    <span>{row.limit ? `${row.percent.toFixed(1)}% di ${numberFormatter.format(row.limit)}` : "Nessun limite registrato"}</span>
                  </div>

                  <div className={`mt-3 grid grid-cols-2 divide-x rounded-xl py-2 ${dark ? "divide-white/10 bg-black/20" : "divide-slate-200 bg-slate-50"}`}>
                    <div className="px-3">
                      <p className={`text-[9px] uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>Input</p>
                      <p className={`mt-0.5 text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>{numberFormatter.format(row.input)}</p>
                    </div>
                    <div className="px-3">
                      <p className={`text-[9px] uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>Output</p>
                      <p className={`mt-0.5 text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>{numberFormatter.format(row.output)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
