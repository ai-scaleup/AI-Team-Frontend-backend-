"use client"

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { Fragment, useState, useEffect, useMemo, useRef } from "react"
import {
    MessageSquare, Loader2, ChevronRight, Search, RefreshCw, Sun, Moon,
    ChevronLeft, Users, UserCheck, User, Mail, Phone, Calendar, X,
    PanelRightClose, PanelRightOpen
} from "lucide-react"

// --- CONFIGURATION ---
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000"
const CHIARA_AVATAR = "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
const USER_AVATAR_URL = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

// --- TYPES ---
interface Session {
    sessionId: string
    lastMessageAt: string
    messageCount: number
}

interface SessionGroup extends Session {
    rawSessionIds: string[]
}

interface ChatLog {
    id: number
    sessionId: string
    sender: string
    messageText: string
    createdAt: string
}

interface ChiaraLead {
    id: number
    sessionId: string
    name: string
    email: string
    phone: string
    createdAt: string
    updatedAt: string
}

// The Leads section lists chiara_whatsapp_leads only — that table holds many
// rows per session, and every row is one captured WhatsApp lead.
//
// Newest first, by database id: ids only ever grow, so the newest lead is the
// highest id, and leads captured in the same second still keep a fixed order.
const sortLeadsById = (leads: ChiaraLead[]) =>
    [...leads].sort((a, b) => b.id - a.id)

const normalizeSessionId = (sessionId: string) => {
    const normalized = sessionId
        .split("||")
        .map(part => part.trim())
        .find(Boolean)

    return normalized || sessionId.trim()
}

const formatSessionLabel = (sessionId: string) =>
    sessionId.length > 24 ? `${sessionId.substring(0, 24)}...` : sessionId

const formatDateTime = (value?: string) => {
    if (!value) return "No date"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "No date"

    return date.toLocaleString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const formatMessageDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Unknown date"

    return date.toLocaleDateString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

const isSameMessageDate = (left?: string, right?: string) => {
    if (!left || !right) return false

    const leftDate = new Date(left)
    const rightDate = new Date(right)

    if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false

    return leftDate.toDateString() === rightDate.toDateString()
}

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

export default function ChiaraAiPage() {
    // --- STATE ---
    const [mounted, setMounted] = useState(false)
    const [isDark, setIsDark] = useState(true)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [section, setSection] = useState<"conversations" | "leads">("conversations")
    const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)

    // Session / Chat state
    const [sessions, setSessions] = useState<Session[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([])
    const [loadingSessions, setLoadingSessions] = useState(true)
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [lastPollTime, setLastPollTime] = useState<string>("Never")

    // Lead of the selected conversation
    const [leadData, setLeadData] = useState<ChiaraLead | null>(null)
    const [loadingLead, setLoadingLead] = useState(false)
    const [showLead, setShowLead] = useState(false)
    const [leadError, setLeadError] = useState<string | null>(null)

    // All WhatsApp leads (Leads section)
    const [allLeads, setAllLeads] = useState<ChiaraLead[]>([])
    const [loadingAllLeads, setLoadingAllLeads] = useState(false)
    const [leadsError, setLeadsError] = useState<string | null>(null)
    const [leadsSearchQuery, setLeadsSearchQuery] = useState("")
    const [selectedLeadForChat, setSelectedLeadForChat] = useState<ChiaraLead | null>(null)
    const [leadChatLogs, setLeadChatLogs] = useState<ChatLog[]>([])
    const [loadingLeadChat, setLoadingLeadChat] = useState(false)

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
            const res = await authenticatedFetch(`${API_BASE}/chiara/chat-logs/sessions`)
            if (res.ok) {
                const data = await res.json()
                setSessions(data)
                setLastPollTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
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

    // --- FETCH ALL LEADS ---
    // Only chiara_whatsapp_leads is read. That group is opened by the
    // development token, which authenticatedFetch sends.
    const fetchAllLeads = async () => {
        setLoadingAllLeads(true)
        try {
            const res = await authenticatedFetch(`${API_BASE}/chiara-whatsapp/leads`)
            if (!res.ok) {
                console.error(`Error fetching WhatsApp leads: ${res.status} ${res.statusText}`)
                setLeadsError("Could not load the WhatsApp leads.")
                setAllLeads([])
                return
            }

            const data = await res.json()
            setLeadsError(null)
            setAllLeads(sortLeadsById(Array.isArray(data) ? data as ChiaraLead[] : []))
        } catch (error) {
            console.error("Error fetching WhatsApp leads:", error)
            setLeadsError("Could not load the WhatsApp leads.")
            setAllLeads([])
        } finally {
            setLoadingAllLeads(false)
        }
    }

    useEffect(() => {
        if (section === "leads") fetchAllLeads()
    }, [section])

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
                            const res = await authenticatedFetch(`${API_BASE}/chiara/chat-logs/${encodeURIComponent(sessionId)}`)
                            if (!res.ok) return []

                            const data = await res.json()
                            return Array.isArray(data) ? data as ChatLog[] : []
                        } catch (error) {
                            console.error(`Error fetching Chiara logs for session ${sessionId}:`, error)
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

    // A lead belongs to the session it was captured on, so drop it when the
    // selection moves elsewhere.
    useEffect(() => {
        setShowLead(false)
        setIsDetailsPanelOpen(false)
        setLeadData(null)
        setLeadError(null)
    }, [selectedSession])

    // --- FETCH THE LEAD OF THE SELECTED SESSION ---
    const fetchLead = async () => {
        if (!selectedSession) return

        setLoadingLead(true)
        setLeadError(null)
        setLeadData(null)
        setShowLead(true)
        setIsDetailsPanelOpen(true)

        // Sessions are merged on their normalized id, but the lead may have been
        // stored under any of the raw ids the group was built from.
        const candidateIds = Array.from(
            new Set([selectedSession, ...(selectedSessionGroup?.rawSessionIds ?? [])])
        )

        try {
            for (const sessionId of candidateIds) {
                const res = await authenticatedFetch(`${API_BASE}/chiara/leads/${encodeURIComponent(sessionId)}`)
                if (!res.ok) continue

                const body = await res.text()
                if (!body) continue

                const data = JSON.parse(body) as ChiaraLead | null
                if (data && data.id) {
                    setLeadData(data)
                    return
                }
            }

            setLeadError("No lead found for this session.")
        } catch (error) {
            console.error("Error fetching lead:", error)
            setLeadError("Could not load the lead for this session.")
        } finally {
            setLoadingLead(false)
        }
    }

    // --- FETCH THE CONVERSATION OF A LEAD ---
    const openLeadConversation = async (lead: ChiaraLead) => {
        setSelectedLeadForChat(lead)
        setLeadChatLogs([])
        setLoadingLeadChat(true)
        try {
            const res = await authenticatedFetch(`${API_BASE}/chiara/chat-logs/${encodeURIComponent(lead.sessionId)}`)
            const data = res.ok ? await res.json() : []
            setLeadChatLogs(dedupeAndSortLogs(Array.isArray(data) ? data as ChatLog[] : []))
        } catch (error) {
            console.error("Error fetching lead conversation:", error)
            setLeadChatLogs([])
        } finally {
            setLoadingLeadChat(false)
        }
    }

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chatLogs])

    // Filter sessions by search
    const filteredSessions = groupedSessions.filter(session =>
        session.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.rawSessionIds.some(rawSessionId => rawSessionId.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const filteredLeads = allLeads.filter(lead => {
        const query = leadsSearchQuery.trim().toLowerCase()
        if (!query) return true

        return String(lead.id).includes(query)
            || lead.name?.toLowerCase().includes(query)
            || lead.email?.toLowerCase().includes(query)
            || lead.phone?.toLowerCase().includes(query)
            || lead.sessionId?.toLowerCase().includes(query)
    })

    // --- SAFE RENDER ---
    if (!mounted) return <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-indigo-500">Loading Chiara AI...</div>

    // ============================
    // RENDER: CONVERSATIONS
    // ============================
    const renderConversations = () => {
        const showDetails = isDetailsPanelOpen && showLead

        return (
            <div className="relative flex flex-col lg:flex-row h-auto lg:h-[calc(100dvh-3rem)] min-h-0 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:overflow-hidden">
                {/* Session List Column */}
                <div className="w-full lg:w-72 xl:w-80 h-64 sm:h-72 lg:h-auto shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate">Chats ({groupedSessions.length})</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-mono">{lastPollTime}</span>
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
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">No sessions found.</p>
                                <button onClick={() => fetchSessions(true)} className="text-[10px] text-indigo-500 hover:underline">
                                    Reload
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
                                        <span>{formatDateTime(session.lastMessageAt)}</span>
                                        <span>{session.messageCount} msg</span>
                                    </div>
                                    {session.rawSessionIds.length > 1 && (
                                        <p className="mt-1 text-[10px] text-indigo-400">
                                            Joined {session.rawSessionIds.length} backend chats
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
                            <span className="truncate">{selectedSession ? `Session: ${formatSessionLabel(selectedSession)}` : "Chat Transcript"}</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {selectedSessionGroup && (
                                <div className="hidden xl:flex flex-col items-end text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                    <span>Last activity: {formatDateTime(selectedSessionGroup.lastMessageAt)}</span>
                                    {selectedSessionGroup.rawSessionIds.length > 1 && (
                                        <span>Joined {selectedSessionGroup.rawSessionIds.length} backend chats</span>
                                    )}
                                </div>
                            )}
                            {selectedSession && chatLogs.length > 0 && (
                                <span className="text-xs opacity-60">{chatLogs.length} messages</span>
                            )}
                            {selectedSession && (
                                <button
                                    onClick={fetchLead}
                                    disabled={loadingLead}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30
                                        ${loadingLead ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    {loadingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                    Show lead
                                </button>
                            )}
                            {showLead && (
                                <button onClick={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)} className={`p-2 rounded-lg backdrop-blur-sm border transition-all ${isDetailsPanelOpen ? 'bg-slate-100/50 dark:bg-black/20 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-500 shadow-md'}`}>
                                    {isDetailsPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
                        {!selectedSession ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <MessageSquare className="w-12 h-12 mb-4" />
                                <p>Select a session to view the conversation</p>
                            </div>
                        ) : loadingLogs ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : chatLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <MessageSquare className="w-10 h-10 mb-3" />
                                <p className="text-sm">No logs found for this session.</p>
                            </div>
                        ) : (
                            chatLogs.map((log, idx) => {
                                const isUser = log.sender === 'user'
                                const showDateSeparator = idx === 0 || !isSameMessageDate(chatLogs[idx - 1]?.createdAt, log.createdAt)

                                return (
                                    <Fragment key={`${log.sessionId}-${log.id}-${idx}`}>
                                        {showDateSeparator && (
                                            <div className="flex justify-center">
                                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                    {formatMessageDate(log.createdAt)}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            {!isUser && <img src={CHIARA_AVATAR} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm object-cover shrink-0" alt="Chiara AI" />}
                                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${isUser
                                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                                }`}>
                                                <p className="whitespace-pre-wrap break-words">{log.messageText}</p>
                                                {log.createdAt && (
                                                    <p className="text-[10px] opacity-40 mt-2 text-right">
                                                        {formatDateTime(log.createdAt)}
                                                    </p>
                                                )}
                                            </div>
                                            {isUser && <img src={USER_AVATAR_URL} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm object-cover shrink-0" alt="User" />}
                                        </div>
                                    </Fragment>
                                )
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Lead details Column */}
                <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden ${showDetails ? 'absolute inset-y-0 right-0 z-30 w-full sm:w-80 opacity-100 shadow-2xl' : 'absolute inset-y-0 right-0 z-30 w-0 opacity-0 pointer-events-none border-0'}`}>
                    <div className="w-full h-full shrink-0 overflow-y-auto custom-scrollbar">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-emerald-900/20">
                            <h2 className="font-semibold flex items-center gap-2 text-sm text-emerald-400">
                                <UserCheck className="w-4 h-4" />
                                Lead details
                            </h2>
                            <button
                                onClick={() => { setShowLead(false); setIsDetailsPanelOpen(false); setLeadData(null); setLeadError(null) }}
                                className="p-1 rounded-md transition-colors hover:bg-white/10 text-gray-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {loadingLead ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : leadError ? (
                                <div className="flex flex-col items-center justify-center py-12 opacity-60">
                                    <UserCheck className="w-10 h-10 mb-3 opacity-30" />
                                    <p className="text-sm text-center">{leadError}</p>
                                </div>
                            ) : leadData ? (
                                <>
                                    {/* Name */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Name</label>
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 opacity-50" />
                                            <span className="text-sm font-medium">{leadData.name}</span>
                                        </div>
                                    </div>
                                    {/* Email */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Email</label>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 opacity-50" />
                                            <span className="text-sm break-all">{leadData.email}</span>
                                        </div>
                                    </div>
                                    {/* Phone */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Phone</label>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 opacity-50" />
                                            <span className="text-sm">{leadData.phone}</span>
                                        </div>
                                    </div>
                                    {/* Created */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Created</label>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 opacity-50" />
                                            <span className="text-sm">{formatDateTime(leadData.createdAt)}</span>
                                        </div>
                                    </div>
                                    {/* Updated */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Updated</label>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 opacity-50" />
                                            <span className="text-sm">{formatDateTime(leadData.updatedAt)}</span>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================
    // RENDER: LEADS
    // ============================
    const renderLeads = () => (
        <div className="relative flex flex-col xl:flex-row gap-4 h-auto xl:h-[calc(100dvh-3rem)] min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main table area */}
            <div className={`flex-1 flex flex-col space-y-6 min-h-0 transition-all duration-300 ${selectedLeadForChat ? 'min-w-0' : ''}`}>
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">WhatsApp leads</h2>
                        <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold border border-teal-500/20">
                            {allLeads.length} total
                        </span>
                    </div>
                    <button
                        onClick={fetchAllLeads}
                        disabled={loadingAllLeads}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 ${loadingAllLeads ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <RefreshCw size={16} className={loadingAllLeads ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Search bar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                    <div className="relative w-full max-w-md">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700/50 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none dark:text-white glass-panel"
                            placeholder="Search by id, name, email, phone or session..."
                            value={leadsSearchQuery}
                            onChange={(e) => setLeadsSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {leadsError && (
                    <div className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                        {leadsError}
                    </div>
                )}

                {/* Table */}
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden flex-1 min-h-0 flex flex-col">
                    {loadingAllLeads ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 opacity-50">
                            <Users className="w-12 h-12 mb-4" />
                            <p className="text-sm">{allLeads.length === 0 ? 'No WhatsApp leads collected yet.' : 'No lead matches the search.'}</p>
                        </div>
                    ) : (
                        <div className="overflow-auto custom-scrollbar flex-1 min-h-0">
                            {/* Every column of chiara_whatsapp_leads, nothing hidden. */}
                            <table className="w-full min-w-[1020px] text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-[#070d1c]">
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">#</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">ID</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Name</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Email</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Phone</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Session</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Created at</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Updated at</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredLeads.map((lead, idx) => (
                                        <tr key={lead.id}
                                            onClick={() => openLeadConversation(lead)}
                                            className={`cursor-pointer transition-colors ${selectedLeadForChat?.id === lead.id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                                }`}>
                                            <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{lead.id}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                        {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{lead.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                    <Mail size={13} className="opacity-40 shrink-0" />
                                                    <span className="break-all">{lead.email || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                    <Phone size={13} className="opacity-40 shrink-0" />
                                                    <span className="whitespace-nowrap">{lead.phone || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded break-all inline-block">
                                                    {lead.sessionId || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                                {formatDateTime(lead.createdAt)}
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                                {formatDateTime(lead.updatedAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Conversation Sidebar */}
            <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${selectedLeadForChat ? 'w-full xl:w-96 min-h-[480px] xl:min-h-0 opacity-100' : 'w-0 h-0 opacity-0 border-0'}`}>
                {selectedLeadForChat && (
                    <div className="w-full flex flex-col h-full">
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-indigo-900/20 shrink-0">
                            <div className="min-w-0">
                                <h3 className="font-semibold text-sm text-indigo-400 flex items-center gap-2">
                                    <MessageSquare size={16} />
                                    {selectedLeadForChat.name || "Conversation"}
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[280px]">{selectedLeadForChat.sessionId}</p>
                            </div>
                            <button
                                onClick={() => { setSelectedLeadForChat(null); setLeadChatLogs([]) }}
                                className="p-1.5 rounded-md transition-colors hover:bg-white/10 text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Lead Strip — every stored column of the selected lead */}
                        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50 bg-emerald-900/10 shrink-0 space-y-1.5 text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2 text-xs">
                                <User size={12} className="opacity-40 shrink-0" />
                                <span className="break-all">{selectedLeadForChat.name || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Mail size={12} className="opacity-40 shrink-0" />
                                <span className="break-all">{selectedLeadForChat.email || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Phone size={12} className="opacity-40 shrink-0" />
                                <span>{selectedLeadForChat.phone || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Calendar size={12} className="opacity-40 shrink-0" />
                                <span>Created {formatDateTime(selectedLeadForChat.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Calendar size={12} className="opacity-40 shrink-0" />
                                <span>Updated {formatDateTime(selectedLeadForChat.updatedAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                <span>#{selectedLeadForChat.id}</span>
                                <span className="uppercase tracking-wider">WhatsApp</span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {loadingLeadChat ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                </div>
                            ) : leadChatLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 opacity-40">
                                    <MessageSquare className="w-10 h-10 mb-3" />
                                    <p className="text-sm">No messages found.</p>
                                </div>
                            ) : (
                                leadChatLogs.map((log, idx) => {
                                    const isUser = log.sender === 'user'
                                    return (
                                        <div key={`${log.sessionId}-${log.id}-${idx}`} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            {!isUser && <img src={CHIARA_AVATAR} className="w-6 h-6 rounded-full shadow-sm object-cover shrink-0 mt-1" alt="Chiara AI" />}
                                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-sm ${isUser
                                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                                }`}>
                                                <p className="whitespace-pre-wrap break-words">{log.messageText}</p>
                                                {log.createdAt && (
                                                    <p className="text-[9px] opacity-40 mt-1 text-right">
                                                        {formatDateTime(log.createdAt)}
                                                    </p>
                                                )}
                                            </div>
                                            {isUser && <img src={USER_AVATAR_URL} className="w-6 h-6 rounded-full shadow-sm object-cover shrink-0 mt-1" alt="User" />}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    // ============================
    // MAIN RETURN
    // ============================
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>{`
                :root { --brand-dark: #020617; --font-tech: 'Rajdhani', sans-serif; }
                body { font-family: var(--font-tech); overflow: hidden; }
                .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); }
                .dark .glass-panel { background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(99, 102, 241, 0.15); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
            `}</style>

            <div className={`flex h-screen w-full ${isDark ? "dark" : ""}`}>
                {/* =================== SIDEBAR =================== */}
                <div className={`glass-panel flex flex-col transition-all duration-300 ease-in-out z-40 ${isSidebarCollapsed ? "w-20" : "w-20 md:w-64"} fixed md:relative h-full border-r border-indigo-100 dark:border-indigo-900/30 overflow-hidden`}>
                    <div className={`p-4 border-b border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-b from-white/50 to-transparent dark:from-indigo-900/20 flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                        {/* Chiara AI Branding */}
                        <div className={`flex items-center gap-3 mb-4 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="relative w-11 h-11 shrink-0 rounded-full border-[2px] border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] overflow-hidden bg-slate-950">
                                <img src={CHIARA_AVATAR} className="w-full h-full object-cover" alt="Chiara AI" />
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="hidden md:block flex-1 min-w-0">
                                    <h1 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none truncate">CHIARA AI</h1>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-500 text-white text-[9px] font-bold tracking-widest shadow-[0_0_10px_rgba(99,102,241,0.5)] uppercase">ONLINE</span>
                                </div>
                            )}
                            {!isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronLeft size={18} /></button>}
                        </div>
                        {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block mb-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronRight size={18} /></button>}

                        {/* Nav Items */}
                        <div className="space-y-1">
                            <button title="Conversations" onClick={() => setSection('conversations')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'conversations' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <MessageSquare size={20} /> {!isSidebarCollapsed && <span className="hidden md:inline">Conversations</span>}
                            </button>
                            <button title="Leads" onClick={() => setSection('leads')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'leads' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <Users size={20} /> {!isSidebarCollapsed && <span className="hidden md:inline">Leads</span>}
                            </button>
                        </div>
                    </div>

                    {/* Bottom controls */}
                    <div className={`mt-auto p-4 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                        {!isSidebarCollapsed && <MockUserButton />}
                        <button onClick={() => setIsDark(!isDark)} title="Toggle theme" className="p-2 rounded-lg backdrop-blur-sm border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 shadow-md">
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>

                {/* =================== MAIN CONTENT =================== */}
                <div className="ml-20 md:ml-0 flex-1 min-w-0 flex flex-col relative h-full overflow-hidden bg-slate-50/50 dark:bg-transparent">
                    <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-6 custom-scrollbar">
                        {section === 'conversations' && renderConversations()}
                        {section === 'leads' && renderLeads()}
                    </div>
                </div>
            </div>
        </>
    )
}
