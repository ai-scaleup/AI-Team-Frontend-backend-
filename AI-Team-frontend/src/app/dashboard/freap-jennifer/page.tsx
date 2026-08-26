"use client"

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { Fragment, useState, useEffect, useMemo, useRef } from "react"
import {
    MessageSquare, User, Loader2, ChevronRight, ChevronLeft, Search, RefreshCw, Sun, Moon
} from "lucide-react"

// --- CONFIGURATION ---
const API_BASE = process.env.NEXT_PUBLIC_API_BASE
const FREAP_JENNIFER_AVATAR = "/assets/agents/chiara-ai-Whats-App-Image-2026-02-25-at-15-34-49-1.jpg"
const USER_AVATAR_URL = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
const ROME_TIME_ZONE = "Europe/Rome"

const formatRomeDateTime = (value: string | Date | null, includeSeconds = false) => {
    if (!value) return "—"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    return date.toLocaleString("it-IT", {
        timeZone: ROME_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" as const } : {}),
    })
}

const formatRomeTime = (value: string | Date, includeSeconds = false) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    return date.toLocaleTimeString("it-IT", {
        timeZone: ROME_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" as const } : {}),
    })
}

const formatRomeMessageDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    return date.toLocaleDateString("it-IT", {
        timeZone: ROME_TIME_ZONE,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

// Compared through the Rome-formatted label so separators follow Rome days, not UTC.
const isSameRomeDate = (left?: string, right?: string) => {
    if (!left || !right) return false

    const leftDate = new Date(left)
    const rightDate = new Date(right)

    if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false

    return formatRomeMessageDate(left) === formatRomeMessageDate(right)
}

const getRomeUtcOffset = () => {
    const offset = new Intl.DateTimeFormat("it-IT", {
        timeZone: ROME_TIME_ZONE,
        timeZoneName: "shortOffset",
    })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value

    return (offset || "GMT+2").replace("GMT", "UTC")
}

// --- TYPES ---
interface ChatLog {
    id: number
    sessionId: string
    sender: string
    messageText: string
    createdAt: string
}

interface Session {
    sessionId: string
    lastMessageAt: string | null
    messageCount: number
}

interface SessionGroup extends Session {
    rawSessionIds: string[]
}

const normalizeSessionId = (sessionId: string) => {
    const normalized = sessionId
        .split("||")
        .map(part => part.trim())
        .find(Boolean)

    return normalized || sessionId.trim()
}

const formatSessionLabel = (sessionId: string) =>
    sessionId.length > 24 ? `${sessionId.substring(0, 24)}...` : sessionId

// Sessions coming from different backend chats are merged on their normalized id,
// the same way the Freap Chiara page joins related transcripts.
const mergeSessions = (sessions: Session[]): SessionGroup[] => {
    const mergedSessions = new Map<string, SessionGroup>()

    sessions.forEach(session => {
        const normalizedSessionId = normalizeSessionId(session.sessionId)
        const existing = mergedSessions.get(normalizedSessionId)

        if (!existing) {
            mergedSessions.set(normalizedSessionId, {
                sessionId: normalizedSessionId,
                lastMessageAt: session.lastMessageAt,
                messageCount: session.messageCount,
                rawSessionIds: [session.sessionId],
            })
            return
        }

        if (!existing.rawSessionIds.includes(session.sessionId)) {
            existing.rawSessionIds.push(session.sessionId)
        }

        existing.messageCount += session.messageCount

        const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0
        const sessionTime = session.lastMessageAt ? new Date(session.lastMessageAt).getTime() : 0

        if (sessionTime > existingTime) {
            existing.lastMessageAt = session.lastMessageAt
        }
    })

    return Array.from(mergedSessions.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0

        return bTime - aTime
    })
}

const dedupeAndSortLogs = (logs: ChatLog[]) => {
    const uniqueLogs = new Map<string, ChatLog>()

    logs.forEach(log => {
        const key = log.id
            ? String(log.id)
            : `${log.sessionId}-${log.sender}-${log.createdAt}-${log.messageText}`

        uniqueLogs.set(key, log)
    })

    return Array.from(uniqueLogs.values()).sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0

        if (aTime !== bTime) return aTime - bTime
        return (a.id || 0) - (b.id || 0)
    })
}

// --- MOCK USER BUTTON ---
const MockUserButton = () => (
    <button className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-indigo-400/50 hover:ring-indigo-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.6)] group cursor-pointer">
        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <User size={20} className="text-indigo-200" />
        </div>
    </button>
)

export default function FreapJenniferPage() {
    // --- STATE ---
    const [mounted, setMounted] = useState(false)
    const [isDark, setIsDark] = useState(true)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    // Session / Chat state
    const [sessions, setSessions] = useState<Session[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([])
    const [loadingSessions, setLoadingSessions] = useState(true)
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [lastPollTime, setLastPollTime] = useState<string>("Mai")

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const groupedSessions = useMemo(() => mergeSessions(sessions), [sessions])
    const selectedSessionGroup = useMemo(
        () => groupedSessions.find(session => session.sessionId === selectedSession),
        [groupedSessions, selectedSession]
    )

    // --- MOUNT + THEME ---
    useEffect(() => {
        setMounted(true)
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme) setIsDark(savedTheme === "dark")
        else setIsDark(true)
    }, [])

    useEffect(() => {
        if (mounted) {
            if (isDark) {
                document.documentElement.classList.add("dark")
                localStorage.setItem("theme", "dark")
            } else {
                document.documentElement.classList.remove("dark")
                localStorage.setItem("theme", "light")
            }
        }
    }, [isDark, mounted])

    // --- FETCH SESSIONS ---
    const fetchSessions = async (isManual = false) => {
        if (isManual) setLoadingSessions(true)
        try {
            const res = await authenticatedFetch(`${API_BASE}/freap-jennifer/chat-logs/sessions`)
            if (res.ok) {
                const data = await res.json()
                // Tolerate the legacy string[] shape as well as the current object shape
                const normalized: Session[] = (Array.isArray(data) ? data : []).map((item: string | Session) =>
                    typeof item === 'string'
                        ? { sessionId: item, lastMessageAt: null, messageCount: 0 }
                        : item
                )
                setSessions(normalized)
                setLastPollTime(new Date().toLocaleTimeString('it-IT', { timeZone: ROME_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            }
        } catch (error) {
            console.error("Error fetching sessions:", error)
        } finally {
            setLoadingSessions(false)
        }
    }

    useEffect(() => {
        fetchSessions(true)
        const interval = setInterval(() => fetchSessions(false), 15000)
        return () => clearInterval(interval)
    }, [])

    // --- FETCH LOGS ---
    useEffect(() => {
        async function fetchLogs() {
            if (!selectedSession) return
            setLoadingLogs(true)
            try {
                const sessionIds = selectedSessionGroup?.rawSessionIds.length
                    ? selectedSessionGroup.rawSessionIds
                    : [selectedSession]

                const logsBySession = await Promise.all(
                    sessionIds.map(async sessionId => {
                        try {
                            const res = await authenticatedFetch(`${API_BASE}/freap-jennifer/chat-logs/${encodeURIComponent(sessionId)}`)
                            if (!res.ok) return []

                            const data = await res.json()
                            return Array.isArray(data) ? data as ChatLog[] : []
                        } catch (error) {
                            console.error(`Error fetching Freap Jennifer logs for session ${sessionId}:`, error)
                            return []
                        }
                    })
                )

                setChatLogs(dedupeAndSortLogs(logsBySession.flat()))
            } catch (error) {
                console.error("Error fetching logs:", error)
            } finally {
                setLoadingLogs(false)
            }
        }
        fetchLogs()
    }, [selectedSession, selectedSessionGroup])

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chatLogs])

    // Filter sessions by search
    const filteredSessions = groupedSessions.filter(session =>
        session.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.rawSessionIds.some(rawSessionId => rawSessionId.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    // --- SAFE RENDER ---
    if (!mounted) return <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-indigo-400">Caricamento Freap Jennifer...</div>

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>{`
                :root { --brand-dark: #020617; --font-tech: 'Rajdhani', sans-serif; }
                body { font-family: var(--font-tech); overflow: hidden; }
                .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); }
                .dark .glass-panel { background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(99, 102, 241, 0.15); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
            `}</style>

            <div className={`flex h-screen w-full ${isDark ? "dark" : ""}`}>
                {/* =================== SIDEBAR =================== */}
                <div className={`glass-panel flex flex-col transition-all duration-300 ease-in-out z-40 ${isSidebarCollapsed ? "w-20" : "w-20 md:w-64"} fixed md:relative h-full border-r border-indigo-100 dark:border-indigo-900/30 overflow-hidden`}>
                    <div className={`p-4 border-b border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-b from-white/50 to-transparent dark:from-indigo-900/20 flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                        {/* Freap Jennifer Branding */}
                        <div className={`flex items-center gap-3 mb-4 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="relative w-11 h-11 shrink-0 rounded-full border-[2px] border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] overflow-hidden bg-slate-950">
                                <img src={FREAP_JENNIFER_AVATAR} className="w-full h-full object-cover" alt="Freap Jennifer" />
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="hidden md:block flex-1 min-w-0">
                                    <h1 className="text-lg font-black text-white uppercase tracking-widest leading-none truncate">FREAP JENNIFER</h1>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-500 text-white text-[9px] font-bold tracking-widest shadow-[0_0_10px_rgba(99,102,241,0.5)] uppercase">ONLINE</span>
                                </div>
                            )}
                            {!isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronLeft size={18} /></button>}
                        </div>
                        {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block mb-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronRight size={18} /></button>}

                        {/* Nav — conversations only */}
                        <div className="space-y-1">
                            <div title="Conversazioni" className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <MessageSquare size={20} /> {!isSidebarCollapsed && <span className="hidden md:inline">Conversazioni</span>}
                            </div>
                        </div>
                    </div>

                    {/* Bottom controls */}
                    <div className={`mt-auto p-4 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                        {!isSidebarCollapsed && <MockUserButton />}
                    </div>
                </div>

                {/* =================== MAIN CONTENT =================== */}
                <div className="ml-20 md:ml-0 flex-1 min-w-0 flex flex-col relative h-full overflow-hidden bg-slate-50/50 dark:bg-transparent">
                    <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-6 custom-scrollbar">
                        <div className="relative flex flex-col lg:flex-row h-auto lg:h-[calc(100dvh-3rem)] min-h-0 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:overflow-hidden">

                            {/* Session List Column */}
                            <div className="w-full lg:w-72 xl:w-80 h-64 sm:h-72 lg:h-auto shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate">Chat ({groupedSessions.length})</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="hidden sm:flex flex-col items-end leading-tight">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400">Roma · {getRomeUtcOffset()}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{lastPollTime}</span>
                                            </div>
                                            <button onClick={() => fetchSessions(true)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${loadingSessions ? 'animate-spin text-indigo-500' : 'text-slate-400'}`}>
                                                <RefreshCw size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                                        <input
                                            className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-lg pl-7 pr-1 py-2 text-xs focus:outline-none dark:text-white"
                                            placeholder="Cerca"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {loadingSessions ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                        </div>
                                    ) : filteredSessions.length === 0 ? (
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Nessuna sessione trovata.</p>
                                            <button onClick={() => fetchSessions(true)} className="text-[10px] text-indigo-500 hover:underline">
                                                Ricarica
                                            </button>
                                        </div>
                                    ) : (
                                        filteredSessions.map(session => (
                                            <div key={session.sessionId}
                                                onClick={() => setSelectedSession(session.sessionId)}
                                                className={`p-2.5 rounded-lg cursor-pointer border transition-all ${String(selectedSession) === String(session.sessionId)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30'
                                                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[200px] font-mono">
                                                        {formatSessionLabel(session.sessionId)}
                                                    </span>
                                                    <ChevronRight size={14} className={`text-slate-400 transition-opacity ${selectedSession === session.sessionId ? 'opacity-100' : 'opacity-0'}`} />
                                                </div>
                                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                                                    <span>{formatRomeDateTime(session.lastMessageAt)}</span>
                                                    <span>{session.messageCount} msg</span>
                                                </div>
                                                {session.rawSessionIds.length > 1 && (
                                                    <p className="mt-1 text-[10px] text-indigo-400">
                                                        Unite {session.rawSessionIds.length} chat backend
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Chat Transcript Column */}
                            <div className="w-full lg:flex-1 h-[65dvh] min-h-[420px] lg:h-auto lg:min-h-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 relative min-w-0">
                                {/* Header */}
                                <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/50 dark:bg-black/20">
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm min-w-0">
                                        <MessageSquare size={16} />
                                        <span className="truncate">{selectedSession ? `Sessione: ${formatSessionLabel(selectedSession)}` : "Conversazione"}</span>
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <span className="sm:hidden text-[9px] font-semibold uppercase tracking-wider text-indigo-400 mr-auto">Roma · {getRomeUtcOffset()}</span>
                                        {selectedSessionGroup && (
                                            <div className="hidden sm:flex flex-col items-end text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                                <span>Ultima attività: {formatRomeDateTime(selectedSessionGroup.lastMessageAt)}</span>
                                                {selectedSessionGroup.rawSessionIds.length > 1 && (
                                                    <span>Unite {selectedSessionGroup.rawSessionIds.length} chat backend</span>
                                                )}
                                            </div>
                                        )}
                                        {selectedSession && chatLogs.length > 0 && (
                                            <span className="text-xs opacity-60">{chatLogs.length} messaggi</span>
                                        )}
                                        <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-lg backdrop-blur-sm border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 shadow-md">
                                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
                                    {!selectedSession ? (
                                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                                            <MessageSquare className="w-12 h-12 mb-4" />
                                            <p>Seleziona una sessione per visualizzare la conversazione</p>
                                        </div>
                                    ) : loadingLogs ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                        </div>
                                    ) : chatLogs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                                            <MessageSquare className="w-10 h-10 mb-3" />
                                            <p className="text-sm">Nessun messaggio trovato per questa sessione.</p>
                                        </div>
                                    ) : (
                                        chatLogs.map((log, idx) => {
                                            const isUser = log.sender === 'user'
                                            const showDateSeparator = idx === 0 || !isSameRomeDate(chatLogs[idx - 1]?.createdAt, log.createdAt)

                                            return (
                                                <Fragment key={`${log.sessionId}-${log.id}-${idx}`}>
                                                    {showDateSeparator && (
                                                        <div className="flex justify-center">
                                                            <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                {formatRomeMessageDate(log.createdAt)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                        {!isUser && <img src={FREAP_JENNIFER_AVATAR} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm object-cover shrink-0" alt="Freap Jennifer" />}
                                                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${isUser
                                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-none'
                                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                                            }`}>
                                                            <p className="whitespace-pre-wrap break-words">{log.messageText}</p>
                                                            {log.createdAt && (
                                                                <p className="text-[10px] opacity-40 mt-2 text-right">
                                                                    {formatRomeTime(log.createdAt)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isUser && <img src={USER_AVATAR_URL} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm object-cover shrink-0" alt="Utente" />}
                                                    </div>
                                                </Fragment>
                                            )
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
