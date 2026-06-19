"use client"

import { useState, useEffect, useRef } from "react"
import {
    MessageSquare, Loader2, ChevronRight, Search, RefreshCw, Sun, Moon,
    ChevronLeft, Bot, User
} from "lucide-react"

// --- CONFIGURATION ---
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000"
const CHIARA_AVATAR = "/assets/agents/Lara-AI-social-strategiest.png"
const USER_AVATAR_URL = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

// --- TYPES ---
interface Session {
    sessionId: string
    lastMessageAt: string
    messageCount: number
}

interface ChatLog {
    id: number
    sessionId: string
    sender: string
    messageText: string
    createdAt: string
}

export default function ChiaraAiPage() {
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
    const [lastPollTime, setLastPollTime] = useState<string>("Never")

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
            const res = await fetch(`${API_BASE}/chiara/chat-logs/sessions`)
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

    // --- FETCH LOGS ---
    useEffect(() => {
        async function fetchLogs() {
            if (!selectedSession) return
            setLoadingLogs(true)
            try {
                const res = await fetch(`${API_BASE}/chiara/chat-logs/${selectedSession}`)
                if (res.ok) {
                    const data = await res.json()
                    setChatLogs(data)
                }
            } catch (error) {
                console.error("Error fetching logs:", error)
            } finally {
                setLoadingLogs(false)
            }
        }
        fetchLogs()
    }, [selectedSession])

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chatLogs])

    // Filter sessions by search
    const filteredSessions = sessions.filter(s =>
        s.sessionId.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // --- SAFE RENDER ---
    if (!mounted) return <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-emerald-500">Loading Chiara AI...</div>

    return (
        <>
            <style>{`
                :root { --font-tech: 'Inter', sans-serif; }
                .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); }
                .dark .glass-panel { background: rgba(15, 23, 42, 0.85); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>

            <div className={`flex h-screen w-full overflow-hidden ${isDark ? "dark" : ""}`}>

                {/* LEFT NAVIGATION SIDEBAR */}
                <div className={`shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-[140px]'}`}>
                    {/* Logo */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-emerald-500/20 shrink-0">
                            <img src={CHIARA_AVATAR} className="w-full h-full object-cover" alt="Chiara AI" />
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="animate-in fade-in duration-200">
                                <h1 className="text-sm font-extrabold text-slate-800 dark:text-white leading-none tracking-tight">CHIARA AI</h1>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 mt-1 inline-block">CRM</span>
                            </div>
                        )}
                    </div>

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="mx-auto mt-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                    >
                        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>

                    {/* Navigation */}
                    <nav className="flex-1 p-2 space-y-1 mt-2">
                        <div
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        >
                            <MessageSquare size={18} />
                            {!isSidebarCollapsed && <span className="text-xs font-bold">Conversations</span>}
                        </div>
                    </nav>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex bg-slate-50 dark:bg-slate-950/50 overflow-hidden">

                    {/* SESSION LIST PANEL */}
                    <div className="w-80 shrink-0 glass-panel flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700/50">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 dark:text-white truncate">Chats ({sessions.length})</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-mono">{lastPollTime}</span>
                                    <button onClick={() => fetchSessions(true)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${loadingSessions ? 'animate-spin text-emerald-500' : 'text-slate-400'}`}>
                                        <RefreshCw size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                                <input
                                    className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-emerald-500 rounded-lg pl-7 pr-1 py-2 text-xs focus:outline-none dark:text-white"
                                    placeholder="Cerca"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {loadingSessions ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : filteredSessions.length === 0 ? (
                                <div className="p-4 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">No sessions found.</p>
                                    <button onClick={() => fetchSessions(true)} className="text-[10px] text-emerald-500 hover:underline">
                                        Reload
                                    </button>
                                </div>
                            ) : (
                                filteredSessions.map(session => (
                                    <div key={session.sessionId}
                                        onClick={() => setSelectedSession(session.sessionId)}
                                        className={`p-2.5 rounded-lg cursor-pointer border transition-all ${String(selectedSession) === String(session.sessionId)
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30'
                                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[200px] font-mono">
                                                {session.sessionId.length > 24 ? session.sessionId.substring(0, 24) + '...' : session.sessionId}
                                            </span>
                                            <ChevronRight size={14} className={`text-slate-400 transition-opacity ${selectedSession === session.sessionId ? 'opacity-100' : 'opacity-0'}`} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* CHAT TRANSCRIPT PANEL */}
                    <div className="flex-1 glass-panel flex flex-col overflow-hidden relative min-w-[300px]">
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
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
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
                                            {!isUser && <img src={CHIARA_AVATAR} className="w-8 h-8 rounded-full shadow-sm object-cover" alt="Chiara AI" />}
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

                </div>
            </div>
        </>
    )
}
