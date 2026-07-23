"use client"

import { useState, useEffect } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import Link from "next/link"
import {
    LayoutDashboard,
    Building2,
    Bot,
    Search,
    Moon,
    Sun,
    Menu,
    X,
    ChevronLeft,
} from "lucide-react"
import { KB_AGENTS, KB_SHARED_AGENTS } from "../_lib/kbData"

type KbShellProps = {
    /** "shared" highlights the Company Info item; otherwise the agent key */
    active: string
    title: string
    subtitle: string
    /** optional controlled search box rendered in the top bar */
    search?: { value: string; onChange: (v: string) => void; placeholder?: string }
    /** content receives the current theme so it can style itself */
    children: (isDark: boolean) => React.ReactNode
}

export default function KbShell({ active, title, subtitle, search, children }: KbShellProps) {
    const { user, isLoaded } = useUser()
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === "undefined") return true
        const savedTheme = localStorage.getItem("theme")
        return savedTheme ? savedTheme === "dark" : true
    })
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add("dark")
            localStorage.setItem("theme", "dark")
        } else {
            document.documentElement.classList.remove("dark")
            localStorage.setItem("theme", "light")
        }
    }, [isDark])

    if (!isLoaded) {
        return (
            <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
                <div className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${isDark ? "border-sky-500" : "border-blue-600"}`} />
            </div>
        )
    }

    if (!user) {
        return (
            <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
                <p className={isDark ? "text-white/60" : "text-gray-600"}>
                    Sign in to access the Knowledge Base.
                </p>
            </div>
        )
    }

    const navItemBase = "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
    const activeCls = isDark ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
    const idleCls = isDark ? "text-white/60 hover:text-white hover:bg-white/5" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"

    // Keep the user's sharedNamespaceId in the URL while navigating within the Knowledge Base
    const kbQuery = user?.id ? `?sharedNamespaceId=${user.id}` : ""

    const Sidebar = (
        <aside className={`flex flex-col w-72 shrink-0 h-screen sticky top-0 border-r ${isDark ? "bg-[#0B1221] border-white/5" : "bg-white border-gray-200"}`}>
            {/* Brand */}
            <div className={`px-5 py-4 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        AI
                    </div>
                    <div>
                        <p className={`font-bold leading-none ${isDark ? "text-white" : "text-gray-900"}`}>AI Team</p>
                        <span className="text-[10px] text-sky-500 font-bold tracking-[0.15em] uppercase">Knowledge Base</span>
                    </div>
                    <button onClick={() => setMobileOpen(false)} className={`ml-auto lg:hidden p-1.5 rounded-lg ${isDark ? "text-white/60 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100"}`}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                <div>
                    <Link href="/dashboard" className={`${navItemBase} ${idleCls}`}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>
                </div>

                <div>
                    <p className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                        Shared
                    </p>
                    <Link
                        href={`/dashboard/knowledgebase${kbQuery}`}
                        className={`${navItemBase} ${active === "shared" ? activeCls : idleCls}`}
                    >
                        <Building2 size={18} /> Company Info
                    </Link>
                    {KB_SHARED_AGENTS.map(agent => (
                        <Link
                            key={agent.key}
                            href={`/dashboard/knowledgebase/${agent.key}`}
                            className={`${navItemBase} ${active === agent.key ? activeCls : idleCls}`}
                        >
                            <Bot size={18} className="shrink-0" />
                            <span className="truncate">{agent.name}</span>
                        </Link>
                    ))}
                </div>

                <div>
                    <p className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                        Agent Info
                    </p>
                    <div className="space-y-1">
                        {KB_AGENTS.map(agent => (
                            <Link
                                key={agent.key}
                                href={`/dashboard/knowledgebase/${agent.key}${kbQuery}`}
                                className={`${navItemBase} ${active === agent.key ? activeCls : idleCls}`}
                            >
                                <Bot size={18} className="shrink-0" />
                                <span className="truncate">{agent.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className={`px-5 py-3 border-t text-[11px] ${isDark ? "border-white/5 text-white/30" : "border-gray-100 text-gray-400"}`}>
                Synced with Pinecone
            </div>
        </aside>
    )

    return (
        <div className={`min-h-screen flex ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
            {/* Desktop sidebar */}
            <div className="hidden lg:block">{Sidebar}</div>

            {/* Mobile sidebar */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[70] lg:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0">{Sidebar}</div>
                </div>
            )}

            {/* Main column */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Top bar */}
                <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDark ? "bg-[#0B1221]/90 border-white/5" : "bg-white/90 border-gray-200"}`}>
                    <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className={`lg:hidden p-2 rounded-lg ${isDark ? "text-white/70 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"}`}>
                            <Menu size={20} />
                        </button>

                        {active !== "shared" && (
                            <Link href={`/dashboard/knowledgebase${kbQuery}`} className={`hidden sm:flex p-2 rounded-lg ${isDark ? "text-white/60 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
                                <ChevronLeft size={18} />
                            </Link>
                        )}

                        <div className="min-w-0">
                            <h1 className={`text-lg font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h1>
                            <p className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>{subtitle}</p>
                        </div>

                        <div className="ml-auto flex items-center gap-2 sm:gap-3">
                            {search && (
                                <div className="relative hidden md:block">
                                    <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                                    <input
                                        type="text"
                                        value={search.value}
                                        onChange={(e) => search.onChange(e.target.value)}
                                        placeholder={search.placeholder ?? "Search..."}
                                        className={`w-56 lg:w-64 py-2 pl-9 pr-3 rounded-xl border text-sm transition-colors outline-none ${isDark
                                            ? "bg-[#1E293B] border-white/10 text-white placeholder:text-white/30 focus:border-sky-500"
                                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
                                            }`}
                                    />
                                </div>
                            )}
                            <button
                                onClick={() => setIsDark(!isDark)}
                                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
                            >
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            <UserButton appearance={{ elements: { avatarBox: `h-8 w-8 ring-2 ${isDark ? "ring-white/10" : "ring-gray-200"}` } }} />
                        </div>
                    </div>

                    {/* Mobile search */}
                    {search && (
                        <div className="md:hidden px-4 pb-3">
                            <div className="relative">
                                <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                                <input
                                    type="text"
                                    value={search.value}
                                    onChange={(e) => search.onChange(e.target.value)}
                                    placeholder={search.placeholder ?? "Search..."}
                                    className={`w-full py-2 pl-9 pr-3 rounded-xl border text-sm outline-none ${isDark
                                        ? "bg-[#1E293B] border-white/10 text-white placeholder:text-white/30 focus:border-sky-500"
                                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
                                        }`}
                                />
                            </div>
                        </div>
                    )}
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">
                    {children(isDark)}
                </main>
            </div>
        </div>
    )
}
