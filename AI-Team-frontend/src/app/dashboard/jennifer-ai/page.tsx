"use client"

import { useState, useEffect } from "react"
import { MessageSquare, User, Bot, Loader2, Calendar, ChevronRight } from "lucide-react"
import JenniferWidget from "@/components/ui/JenniferWidget"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE

interface ChatLog {
    sender: string
    messageText: string
    createdAt: string
}

export default function JenniferPage() {
    const [sessions, setSessions] = useState<string[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([])
    const [loadingSessions, setLoadingSessions] = useState(true)
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [theme, setTheme] = useState<"light" | "dark">("dark") // Default to dark for premium feel

    // Load theme preference
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
        if (savedTheme) {
            setTheme(savedTheme)
        }
    }, [])

    // Fetch Sessions on mount
    useEffect(() => {
        async function fetchSessions() {
            try {
                const res = await fetch(`${API_BASE}/jennifer/sessions`)
                if (res.ok) {
                    const data = await res.json()
                    setSessions(data)
                } else {
                    console.error("Failed to fetch sessions")
                }
            } catch (error) {
                console.error("Error fetching sessions:", error)
            } finally {
                setLoadingSessions(false)
            }
        }

        fetchSessions()
    }, [])

    // Fetch Logs when a session is selected
    useEffect(() => {
        async function fetchLogs() {
            if (!selectedSession) return

            setLoadingLogs(true)
            try {
                const res = await fetch(`${API_BASE}/jennifer/chat-logs/${selectedSession}`)
                if (res.ok) {
                    const data = await res.json()
                    setChatLogs(data)
                } else {
                    console.error("Failed to fetch logs")
                }
            } catch (error) {
                console.error("Error fetching logs:", error)
            } finally {
                setLoadingLogs(false)
            }
        }

        fetchLogs()
    }, [selectedSession])

    return (
        <div className={`min-h-screen p-6 ${theme === "dark" ? "bg-[#020617] text-white" : "bg-gray-50 text-gray-900"}`}>
            <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">

                {/* Header */}
                <header className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                            Jennifer AI Logs
                        </h1>
                        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                            Review chat sessions and history
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-xs font-mono ${theme === "dark" ? "bg-blue-900/30 text-blue-300 border border-blue-800" : "bg-blue-100 text-blue-700"}`}>
                        {sessions.length} archived sessions
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden">

                    {/* Sessions List (Sidebar) */}
                    <div className={`md:col-span-4 lg:col-span-3 flex flex-col rounded-xl border overflow-hidden ${theme === "dark" ? "bg-[#111827]/80 border-white/10" : "bg-white border-gray-200 shadow-sm"}`}>
                        <div className={`p-4 border-b ${theme === "dark" ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
                            <h2 className="font-semibold flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Session History
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {loadingSessions ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : sessions.length === 0 ? (
                                <div className="text-center p-8 text-sm opacity-60">
                                    No sessions found.
                                </div>
                            ) : (
                                sessions.map((sessionId) => (
                                    <button
                                        key={sessionId}
                                        onClick={() => setSelectedSession(sessionId)}
                                        className={`w-full text-left p-3 rounded-lg text-sm transition-all duration-200 flex items-center justify-between group
                      ${selectedSession === sessionId
                                                ? (theme === "dark" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-600 border border-blue-200")
                                                : (theme === "dark" ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700")
                                            }`}
                                    >
                                        <span className="truncate font-mono opacity-80">
                                            {sessionId.length > 20 ? sessionId.substring(0, 20) + '...' : sessionId}
                                        </span>
                                        <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${selectedSession === sessionId ? 'opacity-100' : ''}`} />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Logs View */}
                    <div className={`md:col-span-8 lg:col-span-9 flex flex-col rounded-xl border overflow-hidden ${theme === "dark" ? "bg-[#111827]/80 border-white/10" : "bg-white border-gray-200 shadow-sm"}`}>
                        <div className={`p-4 border-b flex items-center justify-between ${theme === "dark" ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
                            <h2 className="font-semibold flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                {selectedSession ? `Session: ${selectedSession}` : "Chat Transcript"}
                            </h2>
                            {selectedSession && chatLogs.length > 0 && (
                                <span className="text-xs opacity-60">{chatLogs.length} messages</span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {!selectedSession ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-40">
                                    <MessageSquare className="w-12 h-12 mb-4" />
                                    <p>Select a session to view the conversation</p>
                                </div>
                            ) : loadingLogs ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : chatLogs.length === 0 ? (
                                <div className="text-center p-8 opacity-60">
                                    No logs found for this session.
                                </div>
                            ) : (
                                chatLogs.map((log, index) => {
                                    const isUser = log.sender === 'user';
                                    return (
                                        <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>

                                                {/* Avatar */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
                          ${isUser
                                                        ? 'bg-purple-500/20 text-purple-400'
                                                        : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                                </div>

                                                {/* Bubble */}
                                                <div className={`p-4 rounded-2xl text-sm leading-relaxed
                          ${isUser
                                                        ? (theme === "dark" ? 'bg-purple-500/10 border border-purple-500/20 text-purple-100 rounded-tr-none' : 'bg-purple-50 border border-purple-100 text-purple-900 rounded-tr-none')
                                                        : (theme === "dark" ? 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-none' : 'bg-blue-50 border border-blue-100 text-blue-900 rounded-tl-none')
                                                    }`}>
                                                    <p>{log.messageText}</p>
                                                    {log.createdAt && (
                                                        <p className="text-[10px] opacity-40 mt-2 text-right">
                                                            {new Date(log.createdAt).toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div>
            <JenniferWidget />
        </div>
    )
}
