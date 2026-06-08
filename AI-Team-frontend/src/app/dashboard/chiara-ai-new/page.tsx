"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  RefreshCw, LogOut, MessageSquare, Loader2, ChevronRight,
  Sun, Moon, Wifi, WifiOff, AlertCircle, CheckCircle, Clock,
  Save, Bot, User, Settings, FileText
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WhatsappConnectionStatus =
  | "disabled" | "starting" | "qr" | "authenticated" | "ready"
  | "auth_failure" | "disconnected" | "logging_out" | "logout_failed"
  | "initialization_failed"

interface WhatsappQrState {
  status: WhatsappConnectionStatus
  message: string
  qrImageDataUrl: string | null
  qrGeneratedAt: string | null
}

interface ConversationPhoneNumberSummary {
  phoneNumber: string
  messageCount: number
  lastMessageAt: string | null
}

type ConversationRole = "user" | "assistant" | "system"

interface ConversationMessage {
  id: string
  phoneNumber: string
  role: ConversationRole
  content: string
  metadata: unknown | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CHIARA_AVATAR = "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"

async function chiaraFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api/chiara-admin${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  })
  return res
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
}

// Status colour helpers
function statusColor(status: WhatsappConnectionStatus): string {
  switch (status) {
    case "ready":
    case "authenticated":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    case "starting":
    case "logging_out":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    case "qr":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "auth_failure":
    case "disconnected":
    case "initialization_failed":
    case "logout_failed":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30"
  }
}

function statusDot(status: WhatsappConnectionStatus): string {
  switch (status) {
    case "ready":
    case "authenticated":
      return "bg-emerald-400"
    case "starting":
    case "logging_out":
      return "bg-amber-400 animate-pulse"
    case "qr":
      return "bg-blue-400 animate-pulse"
    case "auth_failure":
    case "disconnected":
    case "initialization_failed":
    case "logout_failed":
      return "bg-red-400"
    default:
      return "bg-slate-400"
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ChiaraAiNewPage() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)

  // --- WhatsApp state ---
  const [qrState, setQrState] = useState<WhatsappQrState | null>(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [qrError, setQrError] = useState<string | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [logoutMsg, setLogoutMsg] = useState<string | null>(null)
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Conversations state ---
  const [phoneNumbers, setPhoneNumbers] = useState<ConversationPhoneNumberSummary[]>([])
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // --- Model state ---
  const [currentModel, setCurrentModel] = useState<string>("")
  const [allowedModels, setAllowedModels] = useState<string[]>([])
  const [modelLoading, setModelLoading] = useState(true)
  const [modelSaving, setModelSaving] = useState(false)
  const [modelMsg, setModelMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // --- Prompt state ---
  const [prompt, setPrompt] = useState("")
  const [promptLoading, setPromptLoading] = useState(true)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptMsg, setPromptMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ---------------------------------------------------------------------------
  // Mount + theme
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("theme")
    setIsDark(saved ? saved === "dark" : true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (isDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDark, mounted])

  // ---------------------------------------------------------------------------
  // WhatsApp QR polling
  // ---------------------------------------------------------------------------
  const fetchQr = useCallback(async () => {
    try {
      const res = await chiaraFetch("/whatsapp/qr")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: WhatsappQrState = await res.json()
      setQrState(data)
      setQrError(null)
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "Failed to fetch QR status")
    } finally {
      setQrLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQr()
    qrPollRef.current = setInterval(fetchQr, 3000)
    return () => {
      if (qrPollRef.current) clearInterval(qrPollRef.current)
    }
  }, [fetchQr])

  const handleLogout = async () => {
    if (!qrState || qrState.status === "disabled") return
    setLogoutLoading(true)
    setLogoutMsg(null)
    try {
      const res = await chiaraFetch("/whatsapp/logout", { method: "POST" })
      const data = await res.json()
      setLogoutMsg(res.ok ? "Logged out successfully" : (data?.message ?? "Logout failed"))
      if (res.ok) fetchQr()
    } catch {
      setLogoutMsg("Network error during logout")
    } finally {
      setLogoutLoading(false)
      setTimeout(() => setLogoutMsg(null), 4000)
    }
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------
  const fetchPhoneNumbers = useCallback(async () => {
    setPhoneLoading(true)
    setPhoneError(null)
    try {
      const res = await chiaraFetch("/conversations/phone-numbers?limit=200")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { phoneNumbers: ConversationPhoneNumberSummary[] } = await res.json()
      const filtered = (data.phoneNumbers ?? []).filter(p => !p.phoneNumber.endsWith("@lid"))
      setPhoneNumbers(filtered)
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Failed to load phone numbers")
    } finally {
      setPhoneLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPhoneNumbers()
  }, [fetchPhoneNumbers])

  useEffect(() => {
    if (!selectedPhone) return
    setMsgLoading(true)
    setMsgError(null)
    setMessages([])
    chiaraFetch(`/conversations?phoneNumber=${encodeURIComponent(selectedPhone)}&limit=200`)
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { phoneNumber: string; messages: ConversationMessage[] } = await res.json()
        const filtered = (data.messages ?? []).filter(m => !m.phoneNumber.endsWith("@lid"))
        setMessages(filtered)
      })
      .catch(e => setMsgError(e instanceof Error ? e.message : "Failed to load messages"))
      .finally(() => setMsgLoading(false))
  }, [selectedPhone])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ---------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------
  useEffect(() => {
    chiaraFetch("/model")
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { model: string; allowedModels: string[] } = await res.json()
        setCurrentModel(data.model)
        setAllowedModels(data.allowedModels ?? [])
      })
      .catch(() => setAllowedModels([]))
      .finally(() => setModelLoading(false))
  }, [])

  const saveModel = async () => {
    setModelSaving(true)
    setModelMsg(null)
    try {
      const res = await chiaraFetch("/model", {
        method: "PATCH",
        body: JSON.stringify({ model: currentModel }),
      })
      const data = await res.json()
      setModelMsg(res.ok
        ? { ok: true, text: "Model saved successfully" }
        : { ok: false, text: data?.message ?? `Error ${res.status}` }
      )
    } catch {
      setModelMsg({ ok: false, text: "Network error" })
    } finally {
      setModelSaving(false)
      setTimeout(() => setModelMsg(null), 4000)
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt
  // ---------------------------------------------------------------------------
  useEffect(() => {
    chiaraFetch("/prompt")
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { prompt: string } = await res.json()
        setPrompt(data.prompt ?? "")
      })
      .catch(() => {})
      .finally(() => setPromptLoading(false))
  }, [])

  const savePrompt = async () => {
    setPromptSaving(true)
    setPromptMsg(null)
    try {
      const res = await chiaraFetch("/prompt", {
        method: "PATCH",
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setPromptMsg(res.ok
        ? { ok: true, text: "Prompt saved successfully" }
        : { ok: false, text: data?.message ?? `Error ${res.status}` }
      )
    } catch {
      setPromptMsg({ ok: false, text: "Network error" })
    } finally {
      setPromptSaving(false)
      setTimeout(() => setPromptMsg(null), 4000)
    }
  }

  const promptValid = prompt.length >= 10 && prompt.length <= 20000

  // ---------------------------------------------------------------------------
  // Safe render guard
  // ---------------------------------------------------------------------------
  if (!mounted) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-emerald-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading Chiara Admin…
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <style>{`
        .glass-panel { background: rgba(255,255,255,0.8); backdrop-filter: blur(16px); }
        .dark .glass-panel { background: rgba(15,23,42,0.85); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .section-card { border-radius: 1rem; border: 1px solid; padding: 1.5rem; }
      `}</style>

      <div className={`min-h-screen w-full overflow-y-auto ${isDark ? "dark bg-slate-950" : "bg-slate-50"}`}>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

          {/* ===== TOP BAR ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-emerald-500/20 shrink-0">
                <img src={CHIARA_AVATAR} className="w-full h-full object-cover" alt="Chiara" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                  Chiara AI — Admin Panel
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">chiara-backend.onrender.com</p>
              </div>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 shadow-sm"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* ===== 1. WHATSAPP PAIRING ===== */}
          <section className="section-card glass-panel border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wifi size={18} className="text-emerald-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Chiara — WhatsApp pairing
                </h2>
                {qrState && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusColor(qrState.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(qrState.status)}`} />
                    {qrState.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setQrLoading(true); fetchQr() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                >
                  <RefreshCw size={13} className={qrLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
                <button
                  onClick={handleLogout}
                  disabled={logoutLoading || !qrState || qrState.status === "disabled"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {logoutLoading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  Log out
                </button>
              </div>
            </div>

            {logoutMsg && (
              <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {logoutMsg}
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                  {qrState?.message ?? (qrLoading ? "Loading…" : qrError ?? "—")}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={10} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Updated</p>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-mono">
                  {formatTime(qrState?.qrGeneratedAt ?? null)}
                </p>
              </div>
            </div>

            {/* QR box */}
            <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/50 overflow-hidden" style={{ height: 380 }}>
              {qrLoading && !qrState ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <span className="text-sm">Connecting…</span>
                </div>
              ) : qrError ? (
                <div className="flex flex-col items-center gap-3 text-red-400">
                  <WifiOff className="w-10 h-10" />
                  <span className="text-sm font-medium">{qrError}</span>
                </div>
              ) : qrState?.qrImageDataUrl ? (
                <img
                  src={qrState.qrImageDataUrl}
                  alt="WhatsApp QR Code"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400 px-8 text-center">
                  {qrState?.status === "ready" || qrState?.status === "authenticated" ? (
                    <>
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-400">WhatsApp connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-10 h-10" />
                      <span className="text-sm">{qrState?.message ?? "No QR available"}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ===== 2. CONVERSATIONS ===== */}
          <section className="section-card glass-panel border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  User conversations
                  <span className="text-slate-400 dark:text-slate-500 font-normal"> / </span>
                  Conversations
                </h2>
              </div>
              <button
                onClick={fetchPhoneNumbers}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <RefreshCw size={13} className={phoneLoading ? "animate-spin" : ""} />
                Refresh numbers
              </button>
            </div>

            <div className="flex gap-4 overflow-hidden" style={{ height: 480 }}>
              {/* Phone number sidebar */}
              <div className="shrink-0 w-72 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden bg-white/50 dark:bg-slate-900/30">
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700/50">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Contacts ({phoneNumbers.length})
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {phoneLoading ? (
                    <div className="flex justify-center p-6">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    </div>
                  ) : phoneError ? (
                    <div className="p-4 text-center">
                      <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                      <p className="text-xs text-red-400">{phoneError}</p>
                    </div>
                  ) : phoneNumbers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No conversations yet</div>
                  ) : (
                    phoneNumbers.map(p => (
                      <button
                        key={p.phoneNumber}
                        onClick={() => setSelectedPhone(p.phoneNumber)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${selectedPhone === p.phoneNumber
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 font-mono truncate max-w-[160px]">
                            {p.phoneNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">{p.messageCount}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {p.lastMessageAt ? formatDate(p.lastMessageAt) : "—"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat thread */}
              <div className="flex-1 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden bg-white/50 dark:bg-slate-900/30 min-w-0">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50 shrink-0">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                    {selectedPhone ? selectedPhone : "Select a contact"}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                  {!selectedPhone ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-40">
                      <MessageSquare className="w-10 h-10 mb-2" />
                      <p className="text-sm">Select a phone number to view messages</p>
                    </div>
                  ) : msgLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                  ) : msgError ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-400">
                      <AlertCircle className="w-8 h-8 mb-2" />
                      <p className="text-sm">{msgError}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-40">
                      <MessageSquare className="w-8 h-8 mb-2" />
                      <p className="text-sm">No messages</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isUser = msg.role === "user"
                      const isSystem = msg.role === "system"
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${isUser ? "justify-end ml-auto" : "justify-start mr-auto"} max-w-[85%]`}
                        >
                          {!isUser && (
                            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-1 ${isSystem ? "bg-slate-500" : "bg-emerald-600"}`}>
                              {isSystem ? <Settings size={12} /> : <Bot size={12} />}
                            </div>
                          )}
                          <div className={`rounded-2xl px-3 py-2 text-xs shadow-sm ${
                            isUser
                              ? "bg-blue-500/20 text-blue-100 dark:text-blue-200 border border-blue-500/20 rounded-tr-none"
                              : isSystem
                                ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-tl-none"
                                : "bg-emerald-500/10 text-slate-700 dark:text-emerald-100 border border-emerald-500/20 rounded-tl-none"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isUser ? "bg-blue-500/30 text-blue-300" : isSystem ? "bg-slate-400/30 text-slate-400" : "bg-emerald-500/30 text-emerald-400"
                              }`}>
                                {msg.role}
                              </span>
                              <span className="text-[9px] opacity-50">{formatTime(msg.createdAt)}</span>
                            </div>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          </div>
                          {isUser && (
                            <div className="shrink-0 w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center mt-1">
                              <User size={12} className="text-blue-300" />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {/* Status bar */}
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700/50 shrink-0 bg-slate-50/50 dark:bg-black/10">
                  <p className="text-[10px] text-slate-400 font-mono">
                    {selectedPhone
                      ? msgError
                        ? `Error: ${msgError}`
                        : `${selectedPhone} · ${messages.length} messages`
                      : "No conversation selected"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 3. MODEL ===== */}
          <section className="section-card glass-panel border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-emerald-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  AI configuration
                  <span className="text-slate-400 dark:text-slate-500 font-normal"> / </span>
                  Model
                </h2>
              </div>
              <button
                onClick={saveModel}
                disabled={modelSaving || modelLoading || allowedModels.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {modelSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save model
              </button>
            </div>

            {modelLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
              </div>
            ) : allowedModels.length === 0 ? (
              <p className="text-sm text-red-400">Failed to load models from backend.</p>
            ) : (
              <select
                value={currentModel}
                onChange={e => setCurrentModel(e.target.value)}
                className="w-full max-w-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {allowedModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {modelMsg && (
              <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${modelMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {modelMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {modelMsg.text}
              </div>
            )}
          </section>

          {/* ===== 4. PROMPT ===== */}
          <section className="section-card glass-panel border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Database prompt
                  <span className="text-slate-400 dark:text-slate-500 font-normal"> / </span>
                  User prompt
                </h2>
              </div>
              <button
                onClick={savePrompt}
                disabled={promptSaving || promptLoading || !promptValid}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {promptSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save prompt
              </button>
            </div>

            {promptLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading prompt…
              </div>
            ) : (
              <>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition resize-y"
                  style={{ minHeight: 288 }}
                  placeholder="Enter system prompt (10–20000 characters)…"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs font-mono ${prompt.length > 20000 ? "text-red-400" : prompt.length < 10 ? "text-amber-400" : "text-slate-400"}`}>
                    {prompt.length.toLocaleString()}/20000 characters
                  </p>
                  {!promptValid && prompt.length > 0 && (
                    <p className="text-xs text-amber-400">
                      {prompt.length < 10 ? "Minimum 10 characters" : "Maximum 20000 characters exceeded"}
                    </p>
                  )}
                </div>
              </>
            )}

            {promptMsg && (
              <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${promptMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {promptMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {promptMsg.text}
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  )
}
