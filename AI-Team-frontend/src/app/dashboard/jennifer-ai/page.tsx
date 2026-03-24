"use client"


import { useState, useEffect, useRef } from "react"
import {
    MessageSquare, User, Bot, Loader2, Calendar, ChevronRight, UserCheck, X, Mail, Phone,
    BarChart3, ChevronLeft, Search, RefreshCw, Sun, Moon, Settings, Archive, PanelRightClose, PanelRightOpen, Users,
    Tag, Plus, Trash2, Edit3, Check
} from "lucide-react"


// --- CONFIGURATION ---
const API_BASE = process.env.NEXT_PUBLIC_API_BASE
const JENNIFER_AVATAR = "https://i.ibb.co.com/mVR9YXMD/Whats-App-Image-2026-02-25-at-15-34-49-1.jpg"
const USER_AVATAR_URL = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

// --- TYPES ---
interface ChatLog {
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

interface TagField {
    id: string
    tagName: string
    description?: string
    createdAt: string
    updatedAt: string
}

// --- MOCK USER BUTTON ---
const MockUserButton = () => (
    <button className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-indigo-400/50 hover:ring-indigo-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.6)] group cursor-pointer">
        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <User size={20} className="text-indigo-200" />
        </div>
    </button>
)

export default function JenniferPage() {
    // --- STATE ---
    const [mounted, setMounted] = useState(false)
    const [isDark, setIsDark] = useState(true)
    const [section, setSection] = useState<"analytics" | "conversations" | "leads" | "tags">("conversations")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)

    // Session / Chat state
    const [sessions, setSessions] = useState<string[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([])
    const [loadingSessions, setLoadingSessions] = useState(true)
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [lastPollTime, setLastPollTime] = useState<string>("Never")

    // Lead state
    const [leadData, setLeadData] = useState<ChiaraLead | null>(null)
    const [loadingLead, setLoadingLead] = useState(false)
    const [showLead, setShowLead] = useState(false)
    const [leadError, setLeadError] = useState<string | null>(null)

    // All leads state (for Leads tab)
    const [allLeads, setAllLeads] = useState<ChiaraLead[]>([])
    const [loadingAllLeads, setLoadingAllLeads] = useState(false)
    const [leadsSearchQuery, setLeadsSearchQuery] = useState("")
    const [selectedLeadForChat, setSelectedLeadForChat] = useState<ChiaraLead | null>(null)
    const [leadChatLogs, setLeadChatLogs] = useState<ChatLog[]>([])
    const [loadingLeadChat, setLoadingLeadChat] = useState(false)

    // Tags state
    const [tagFields, setTagFields] = useState<TagField[]>([])
    const [loadingTagFields, setLoadingTagFields] = useState(false)
    const [tagForm, setTagForm] = useState({ tagName: '', description: '' })
    const [editingTagField, setEditingTagField] = useState<TagField | null>(null)
    const [editForm, setEditForm] = useState({ tagName: '', description: '' })
    const [savingTag, setSavingTag] = useState(false)
    const [deletingTagId, setDeletingTagId] = useState<string | null>(null)

    // Generated tags for conversation
    const [generatedTags, setGeneratedTags] = useState<string[]>([])
    const [loadingGenerateTags, setLoadingGenerateTags] = useState(false)
    const [showTagsPanel, setShowTagsPanel] = useState(false)

    // Leads tags state
    const [leadsTags, setLeadsTags] = useState<Record<string, string[]>>({})
    const [loadingLeadsTags, setLoadingLeadsTags] = useState(false)

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)

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
            const res = await fetch(`${API_BASE}/jennifer/sessions`)
            if (res.ok) {
                const data = await res.json()
                setSessions([...data].sort((a: string, b: string) => b.localeCompare(a)))
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
    const fetchAllLeads = async () => {
        setLoadingAllLeads(true)
        try {
            const res = await fetch(`${API_BASE}/chiara/leads`)
            if (res.ok) {
                const data = await res.json()
                setAllLeads(data)
            }
        } catch (error) {
            console.error("Error fetching all leads:", error)
        } finally {
            setLoadingAllLeads(false)
        }
    }

    useEffect(() => {
        if (section === 'leads') {
            fetchAllLeads()
        }
        if (section === 'tags') {
            fetchTagFields()
        }
    }, [section])

    // --- AUTO-FETCH TAGS FOR ALL LEADS ---
    useEffect(() => {
        if (section !== 'leads' || allLeads.length === 0) return
        const fetchTagsForLeads = async () => {
            setLoadingLeadsTags(true)
            const tagsMap: Record<string, string[]> = {}
            await Promise.all(
                allLeads.map(async (lead) => {
                    try {
                        // First try to get existing tags
                        const res = await fetch(`${API_BASE}/tags/session/${lead.sessionId}`)
                        if (res.ok) {
                            const data = await res.json()
                            if (data && data.tags && data.tags.length > 0) {
                                tagsMap[lead.sessionId] = data.tags
                                return
                            }
                        }
                        // If no existing tags, generate them
                        const genRes = await fetch(`${API_BASE}/tags/generate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: lead.sessionId }),
                        })
                        if (genRes.ok) {
                            const genData = await genRes.json()
                            tagsMap[lead.sessionId] = genData.tags || []
                        } else {
                            tagsMap[lead.sessionId] = []
                        }
                    } catch {
                        tagsMap[lead.sessionId] = []
                    }
                })
            )
            setLeadsTags(tagsMap)
            setLoadingLeadsTags(false)
        }
        fetchTagsForLeads()
    }, [section, allLeads])

    // --- TAG FIELD CRUD ---
    const fetchTagFields = async () => {
        setLoadingTagFields(true)
        try {
            const res = await fetch(`${API_BASE}/tags/fields`)
            if (res.ok) {
                const data = await res.json()
                setTagFields(data)
            }
        } catch (error) {
            console.error('Error fetching tag fields:', error)
        } finally {
            setLoadingTagFields(false)
        }
    }

    const createTagField = async () => {
        if (!tagForm.tagName.trim()) return
        setSavingTag(true)
        try {
            const res = await fetch(`${API_BASE}/tags/fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tagForm),
            })
            if (res.ok) {
                setTagForm({ tagName: '', description: '' })
                fetchTagFields()
            }
        } catch (error) {
            console.error('Error creating tag field:', error)
        } finally {
            setSavingTag(false)
        }
    }

    const updateTagField = async (id: string) => {
        if (!editForm.tagName.trim()) return
        setSavingTag(true)
        try {
            const res = await fetch(`${API_BASE}/tags/fields/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            })
            if (res.ok) {
                setEditingTagField(null)
                fetchTagFields()
            }
        } catch (error) {
            console.error('Error updating tag field:', error)
        } finally {
            setSavingTag(false)
        }
    }

    const deleteTagField = async (id: string) => {
        setDeletingTagId(id)
        try {
            const res = await fetch(`${API_BASE}/tags/fields/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchTagFields()
            }
        } catch (error) {
            console.error('Error deleting tag field:', error)
        } finally {
            setDeletingTagId(null)
        }
    }

    // --- FETCH LOGS & TAGS ---
    useEffect(() => {
        async function fetchLogsAndTags() {
            if (!selectedSession) return
            setLoadingLogs(true)
            setGeneratedTags([])
            setShowTagsPanel(false)

            try {
                // Fetch Logs
                const resLogs = await fetch(`${API_BASE}/jennifer/chat-logs/${selectedSession}`)
                if (resLogs.ok) {
                    const data = await resLogs.json()
                    setChatLogs(data)
                }
            } catch (error) {
                console.error("Error fetching logs:", error)
            } finally {
                setLoadingLogs(false)
            }

            try {
                // Fetch Tags automatically
                const resTags = await fetch(`${API_BASE}/tags/session/${selectedSession}`)
                if (resTags.ok) {
                    const data = await resTags.json()
                    if (data && data.tags && data.tags.length > 0) {
                        setGeneratedTags(data.tags)
                        setShowTagsPanel(true)
                    }
                }
            } catch (error) {
                console.error("Error fetching session tags:", error)
            }
        }
        fetchLogsAndTags()
    }, [selectedSession])

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chatLogs])

    // --- FETCH LEAD ---
    async function fetchLead() {
        if (!selectedSession) return
        setLoadingLead(true)
        setLeadError(null)
        setShowLead(true)
        setIsDetailsPanelOpen(true)
        try {
            const res = await fetch(`${API_BASE}/chiara/leads/${selectedSession}`)
            if (res.ok) {
                const data = await res.json()
                if (data) {
                    setLeadData(data)
                } else {
                    setLeadData(null)
                    setLeadError("No lead found for this session.")
                }
            } else if (res.status === 404) {
                setLeadData(null)
                setLeadError("No lead found for this session.")
            } else {
                setLeadError("Failed to fetch lead data.")
            }
        } catch (error) {
            console.error("Error fetching lead:", error)
            setLeadError("Error fetching lead data.")
        } finally {
            setLoadingLead(false)
        }
    }

    // --- ANALYTICS ---
    const totalSessions = sessions.length
    const totalMessages = chatLogs.length

    // --- GENERATE TAGS ---
    const generateSessionTags = async () => {
        if (!selectedSession) return
        setLoadingGenerateTags(true)
        setShowTagsPanel(true)
        try {
            const url = `${API_BASE}/tags/generate`
            console.log('[GenerateTags] Calling:', url, 'with sessionId:', selectedSession)
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: selectedSession }),
            })
            console.log('[GenerateTags] Response status:', res.status)
            const data = await res.json()
            console.log('[GenerateTags] Response data:', JSON.stringify(data))
            if (res.ok) {
                const tags = data.tags || []
                console.log('[GenerateTags] Setting tags:', tags)
                setGeneratedTags(tags)
            } else {
                console.error('[GenerateTags] API error:', data)
                setGeneratedTags([])
            }
        } catch (error) {
            console.error('[GenerateTags] Fetch error:', error)
            setGeneratedTags([])
        } finally {
            setLoadingGenerateTags(false)
        }
    }

    // Filter sessions by search
    const filteredSessions = sessions.filter(s =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // --- SAFE RENDER ---
    if (!mounted) return <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-indigo-500">Loading Jennifer AI...</div>

    // ============================
    // RENDER: ANALYTICS
    // ============================
    const renderAnalytics = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Total Sessions */}
                <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium">Total Sessions</h3>
                        <span className="px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1">
                            <MessageSquare size={12} /> Live
                        </span>
                    </div>
                    <div className="text-5xl font-bold text-slate-800 dark:text-white mb-2">
                        {totalSessions}
                    </div>
                    <p className="text-sm text-slate-400">Unique chat sessions recorded</p>
                </div>

                {/* Card 2: Messages in Selected Session */}
                <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium">Messages (Selected)</h3>
                        <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                            <BarChart3 size={12} /> Count
                        </span>
                    </div>
                    <div className="text-5xl font-bold text-slate-800 dark:text-white mb-2">
                        {selectedSession ? totalMessages : "—"}
                    </div>
                    <p className="text-sm text-slate-400">
                        {selectedSession ? `Messages in session ${selectedSession.substring(0, 12)}...` : "Select a session to see message count"}
                    </p>
                </div>
            </div>

            {/* Session Activity List */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calendar size={16} /> Recent Sessions
                    </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {sessions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-400">No sessions found.</div>
                    ) : (
                        sessions.slice(0, 20).map((sessionId, idx) => (
                            <div key={sessionId} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => { setSelectedSession(sessionId); setSection("conversations") }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                        {idx + 1}
                                    </div>
                                    <span className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate max-w-[300px]">
                                        {sessionId}
                                    </span>
                                </div>
                                <ChevronRight size={16} className="text-slate-400" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )

    // ============================
    // RENDER: CONVERSATIONS
    // ============================
    const renderConversations = () => {
        const showDetails = isDetailsPanelOpen && showLead
        return (
            <div className="flex h-[calc(100vh-140px)] gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                {/* Session List Column */}
                <div className="w-80 shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate">Chats ({sessions.length})</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-mono">{lastPollTime}</span>
                                <button onClick={() => fetchSessions(true)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${loadingSessions ? 'animate-spin text-indigo-500' : 'text-slate-400'}`}>
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                                <input
                                    className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-lg pl-7 pr-1 py-2 text-xs focus:outline-none dark:text-white"
                                    placeholder="Cerca"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
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
                            filteredSessions.map(sessionId => (
                                <div key={sessionId}
                                    onClick={() => setSelectedSession(sessionId)}
                                    className={`p-2.5 rounded-lg cursor-pointer border transition-all ${String(selectedSession) === String(sessionId)
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30'
                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[200px] font-mono">
                                            {sessionId.length > 24 ? sessionId.substring(0, 24) + '...' : sessionId}
                                        </span>
                                        <ChevronRight size={14} className={`text-slate-400 transition-opacity ${selectedSession === sessionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Transcript Column */}
                <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 relative min-w-[300px]">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-white/50 dark:bg-black/20">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                            <MessageSquare size={16} />
                            {selectedSession ? `Session: ${selectedSession.substring(0, 20)}...` : "Chat Transcript"}
                        </h3>
                        <div className="flex items-center gap-3">
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
                                    {loadingLead ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <UserCheck className="w-3.5 h-3.5" />
                                    )}
                                    Get Lead
                                </button>
                            )}
                            {selectedSession && (
                                <button
                                    onClick={generateSessionTags}
                                    disabled={loadingGenerateTags}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30
                                        ${loadingGenerateTags ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    {loadingGenerateTags ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Tag className="w-3.5 h-3.5" />
                                    )}
                                    Generate Tags
                                </button>
                            )}
                            {showLead && (
                                <button onClick={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)} className={`p-2 rounded-lg backdrop-blur-sm border transition-all ${isDetailsPanelOpen ? 'bg-slate-100/50 dark:bg-black/20 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-500 shadow-md'}`}>
                                    {isDetailsPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                </button>
                            )}
                            {generatedTags.length > 0 && (
                                <button onClick={() => setShowTagsPanel(!showTagsPanel)} className={`p-2 rounded-lg backdrop-blur-sm border transition-all ${showTagsPanel ? 'bg-slate-100/50 dark:bg-black/20 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-purple-500 shadow-md'}`}>
                                    {showTagsPanel ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                </button>
                            )}
                            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-lg backdrop-blur-sm border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 shadow-md">
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
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
                                return (
                                    <div key={idx} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        {!isUser && <img src={JENNIFER_AVATAR} className="w-8 h-8 rounded-full shadow-sm object-cover" alt="Jennifer AI" />}
                                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${isUser
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-none'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                            }`}>
                                            <p>{log.messageText}</p>
                                            {log.createdAt && (
                                                <p className="text-[10px] opacity-40 mt-2 text-right">
                                                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                        {isUser && <img src={USER_AVATAR_URL} className="w-8 h-8 rounded-full shadow-sm object-cover" alt="User" />}
                                    </div>
                                )
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Lead Details Column */}
                <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden ${showDetails ? 'w-72 opacity-100 mr-0' : 'w-0 opacity-0 -mr-4 border-0'}`}>
                    <div className="w-72 shrink-0">
                        <div className={`p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-emerald-900/20`}>
                            <h2 className="font-semibold flex items-center gap-2 text-sm text-emerald-400">
                                <UserCheck className="w-4 h-4" />
                                Lead Details
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
                                            <span className="text-sm">{new Date(leadData.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    {/* Updated */}
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block text-gray-500">Updated</label>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 opacity-50" />
                                            <span className="text-sm">{new Date(leadData.updatedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Tags Sidebar Column */}
                <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden ${showTagsPanel && generatedTags.length > 0 ? 'w-72 opacity-100 mr-0' : 'w-0 opacity-0 -mr-4 border-0'}`}>
                    <div className="w-72 shrink-0">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-purple-900/20">
                            <h2 className="font-semibold flex items-center gap-2 text-sm text-purple-400">
                                <Tag className="w-4 h-4" />
                                Generated Tags
                            </h2>
                            <button
                                onClick={() => setShowTagsPanel(false)}
                                className="p-1 rounded-md transition-colors hover:bg-white/10 text-gray-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {loadingGenerateTags ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                </div>
                            ) : generatedTags.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 opacity-60">
                                    <Tag className="w-10 h-10 mb-3 opacity-30" />
                                    <p className="text-sm text-center">No tags generated.</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">Matched Tags ({generatedTags.length})</p>
                                    <div className="space-y-2">
                                        {generatedTags.map((tag, idx) => (
                                            <div key={idx} className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
                                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0"></span>
                                                <span className="text-sm font-medium text-purple-300">{tag}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-slate-700/30">
                                        <p className="text-[10px] text-slate-500">Tags are generated by AI based on admin-defined Tag Fields.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================
    // RENDER: LEADS
    // ============================
    const renderLeads = () => {
        const filteredLeads = allLeads.filter(lead =>
            lead.name?.toLowerCase().includes(leadsSearchQuery.toLowerCase()) ||
            lead.email?.toLowerCase().includes(leadsSearchQuery.toLowerCase()) ||
            lead.phone?.toLowerCase().includes(leadsSearchQuery.toLowerCase()) ||
            lead.sessionId?.toLowerCase().includes(leadsSearchQuery.toLowerCase())
        )

        return (
            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ height: 'calc(100vh - 140px)' }}>
                {/* Main table area */}
                <div className={`flex-1 flex flex-col space-y-6 overflow-hidden transition-all duration-300 ${selectedLeadForChat ? 'min-w-0' : ''}`}>
                    {/* Header row */}
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Leads</h2>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
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
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700/50 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none dark:text-white glass-panel"
                            placeholder="Search by name, email, phone, or session..."
                            value={leadsSearchQuery}
                            onChange={(e) => setLeadsSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                        {loadingAllLeads ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 opacity-50">
                                <Users className="w-12 h-12 mb-4" />
                                <p className="text-sm">{allLeads.length === 0 ? 'No leads collected yet.' : 'No leads match your search.'}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-black/20">
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">#</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Name</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Email</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Phone</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Session</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Tags</th>
                                            <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredLeads.map((lead, idx) => (
                                            <tr key={lead.id || idx}
                                                onClick={() => {
                                                    setSelectedLeadForChat(lead)
                                                    setLoadingLeadChat(true)
                                                    fetch(`${API_BASE}/jennifer/chat-logs/${lead.sessionId}`)
                                                        .then(res => res.ok ? res.json() : [])
                                                        .then(data => setLeadChatLogs(data))
                                                        .catch(() => setLeadChatLogs([]))
                                                        .finally(() => setLoadingLeadChat(false))
                                                }}
                                                className={`cursor-pointer transition-colors ${selectedLeadForChat?.id === lead.id
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                                    }`}>
                                                <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                            {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <span className="font-medium text-slate-700 dark:text-slate-200">{lead.name || '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                        <Mail size={13} className="opacity-40" />
                                                        <span className="truncate max-w-[200px]">{lead.email || '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                        <Phone size={13} className="opacity-40" />
                                                        <span>{lead.phone || '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded truncate max-w-[150px] inline-block">
                                                        {lead.sessionId ? (lead.sessionId.length > 18 ? lead.sessionId.substring(0, 18) + '...' : lead.sessionId) : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1 max-w-[250px]">
                                                        {loadingLeadsTags ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                                                        ) : leadsTags[lead.sessionId] && leadsTags[lead.sessionId].length > 0 ? (
                                                            leadsTags[lead.sessionId].map((tag, tIdx) => (
                                                                <span key={tIdx} title={tag} className="w-3 h-3 rounded-full bg-purple-500 border border-purple-400/50 shadow-[0_0_6px_rgba(168,85,247,0.4)] cursor-default" />
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-slate-500">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
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
                <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${selectedLeadForChat ? 'w-96 opacity-100' : 'w-0 opacity-0 border-0'}`}>
                    {selectedLeadForChat && (
                        <div className="w-96 flex flex-col h-full">
                            {/* Sidebar Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-indigo-900/20 shrink-0">
                                <div>
                                    <h3 className="font-semibold text-sm text-indigo-400 flex items-center gap-2">
                                        <MessageSquare size={16} />
                                        Conversation
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



                            {/* Tags Strip */}
                            {leadsTags[selectedLeadForChat.sessionId] && leadsTags[selectedLeadForChat.sessionId].length > 0 && (
                                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50 bg-purple-900/10 shrink-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Tag size={12} className="text-purple-400 shrink-0" />
                                        {leadsTags[selectedLeadForChat.sessionId].map((tag, tIdx) => (
                                            <span key={tIdx} className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-[10px] font-medium border border-purple-500/20">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                            <div key={idx} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                {!isUser && <img src={JENNIFER_AVATAR} className="w-6 h-6 rounded-full shadow-sm object-cover shrink-0 mt-1" alt="AI" />}
                                                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-sm ${isUser
                                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-none'
                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                                    }`}>
                                                    <p>{log.messageText}</p>
                                                    {log.createdAt && (
                                                        <p className="text-[9px] opacity-40 mt-1 text-right">
                                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
    }

    // ============================
    // RENDER: TAGS
    // ============================
    const renderTags = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Tag Fields</h2>
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20">
                        {tagFields.length} total
                    </span>
                </div>
                <button
                    onClick={fetchTagFields}
                    disabled={loadingTagFields}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 ${loadingTagFields ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <RefreshCw size={16} className={loadingTagFields ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Create Form */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Plus size={14} /> Create New Tag Field
                </h3>
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Tag Name *</label>
                        <input
                            className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700/50 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none dark:text-white"
                            placeholder="e.g. Sales Inquiry"
                            value={tagForm.tagName}
                            onChange={(e) => setTagForm({ ...tagForm, tagName: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && createTagField()}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Description (optional)</label>
                        <input
                            className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700/50 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none dark:text-white"
                            placeholder="Brief description of this tag"
                            value={tagForm.description}
                            onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && createTagField()}
                        />
                    </div>
                    <button
                        onClick={createTagField}
                        disabled={savingTag || !tagForm.tagName.trim()}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 ${savingTag || !tagForm.tagName.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                    >
                        {savingTag ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Add
                    </button>
                </div>
            </div>

            {/* Tag Fields Table */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                {loadingTagFields ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : tagFields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-50">
                        <Tag className="w-12 h-12 mb-4" />
                        <p className="text-sm">No tag fields created yet.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-black/20">
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">#</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Tag Name</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Created</th>
                                <th className="text-right px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {tagFields.map((tf, idx) => (
                                <tr key={tf.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-5 py-4">
                                        {editingTagField?.id === tf.id ? (
                                            <input
                                                className="bg-white dark:bg-black/30 border border-indigo-500 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none dark:text-white w-full max-w-[200px]"
                                                value={editForm.tagName}
                                                onChange={(e) => setEditForm({ ...editForm, tagName: e.target.value })}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                                {tf.tagName}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {editingTagField?.id === tf.id ? (
                                            <input
                                                className="bg-white dark:bg-black/30 border border-indigo-500 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none dark:text-white w-full max-w-[250px]"
                                                value={editForm.description}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            />
                                        ) : (
                                            <span className="text-slate-500 dark:text-slate-400">{tf.description || '—'}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                        {new Date(tf.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingTagField?.id === tf.id ? (
                                                <>
                                                    <button
                                                        onClick={() => updateTagField(tf.id)}
                                                        disabled={savingTag}
                                                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                                    >
                                                        {savingTag ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingTagField(null)}
                                                        className="p-2 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 transition-all cursor-pointer"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => { setEditingTagField(tf); setEditForm({ tagName: tf.tagName, description: tf.description || '' }) }}
                                                        className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTagField(tf.id)}
                                                        disabled={deletingTagId === tf.id}
                                                        className={`p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all ${deletingTagId === tf.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {deletingTagId === tf.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
            `}</style>

            <div className={`flex h-screen w-full ${isDark ? "dark" : ""}`}>
                {/* =================== SIDEBAR =================== */}
                <div className={`glass-panel flex flex-col transition-all duration-300 ease-in-out z-40 ${isSidebarCollapsed ? "w-20" : "w-64"} fixed md:relative h-full border-r border-indigo-100 dark:border-indigo-900/30 overflow-hidden`}>
                    <div className={`p-4 border-b border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-b from-white/50 to-transparent dark:from-indigo-900/20 flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                        {/* Jennifer AI Branding */}
                        <div className={`flex items-center gap-3 mb-4 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="relative w-11 h-11 shrink-0 rounded-full border-[2px] border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] overflow-hidden bg-slate-950">
                                <img src={JENNIFER_AVATAR} className="w-full h-full object-cover" alt="Jennifer AI" />
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-lg font-black text-white uppercase tracking-widest leading-none truncate">JENNIFER AI</h1>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-500 text-white text-[9px] font-bold tracking-widest shadow-[0_0_10px_rgba(99,102,241,0.5)] uppercase">ONLINE</span>
                                </div>
                            )}
                            {!isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronLeft size={18} /></button>}
                        </div>
                        {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><ChevronRight size={18} /></button>}

                        {/* Nav Items */}
                        <div className="space-y-1">
                            <button onClick={() => setSection('analytics')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'analytics' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <BarChart3 size={20} /> {!isSidebarCollapsed && "Analytics"}
                            </button>
                            <button onClick={() => setSection('conversations')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'conversations' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <MessageSquare size={20} /> {!isSidebarCollapsed && "Conversations"}
                            </button>
                            <button onClick={() => setSection('leads')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'leads' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <Users size={20} /> {!isSidebarCollapsed && "Leads"}
                            </button>
                            <button onClick={() => setSection('tags')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${section === 'tags' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                <Tag size={20} /> {!isSidebarCollapsed && "Tags"}
                            </button>
                        </div>
                    </div>

                    {/* Bottom controls */}
                    <div className={`mt-auto p-4 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                        {!isSidebarCollapsed && <MockUserButton />}
                    </div>
                </div>

                {/* =================== MAIN CONTENT =================== */}
                <div className="flex-1 flex flex-col relative h-full overflow-hidden bg-slate-50/50 dark:bg-transparent">
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
                        {section === 'analytics' && renderAnalytics()}
                        {section === 'conversations' && renderConversations()}
                        {section === 'leads' && renderLeads()}
                        {section === 'tags' && renderTags()}
                    </div>
                </div>
            </div>


        </>
    )
}
