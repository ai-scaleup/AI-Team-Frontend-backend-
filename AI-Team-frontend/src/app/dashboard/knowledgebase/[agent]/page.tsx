"use client"
export const dynamic = "force-dynamic"

import { useState, use } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sparkles, Bot } from "lucide-react"
import KbShell from "../_components/KbShell"
import PineconeDocuments from "../_components/PineconeDocuments"
import { KB_AGENTS, KB_SHARED_AGENTS } from "../_lib/kbData"

export default function AgentKnowledgeBasePage({ params }: { params: Promise<{ agent: string }> }) {
    const { agent } = use(params)
    // sharedNamespaceId passed from the agent dashboards (?sharedNamespaceId=<clerk user id>)
    const sharedNamespaceId = useSearchParams().get("sharedNamespaceId") ?? ""
    const isDedicatedIndex = KB_SHARED_AGENTS.some(a => a.key === agent)
    const agentMemoryNamespace = isDedicatedIndex
        ? ""
        : sharedNamespaceId && agent
            ? `${sharedNamespaceId}-${agent}`
            : ""
    const meta = [...KB_SHARED_AGENTS, ...KB_AGENTS].find(a => a.key === agent) ?? { key: agent, name: agent, role: "AI Agent", suggestion: "Upload useful documents for this agent" }

    const [query, setQuery] = useState("")

    return (
        <KbShell
            active={agent}
            title={`${meta.name} - Agent Info`}
            subtitle={`Dedicated Knowledge Base - ${meta.role}`}
            search={{ value: query, onChange: setQuery, placeholder: "Search documents..." }}
        >
            {(isDark) => (
                <div className="space-y-6">
                    {/* Agent header card */}
                    <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-600 flex items-center justify-center text-white shrink-0">
                            <Bot size={26} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{meta.name}</h2>
                            <p className={`text-sm ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{meta.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/dashboard/${agent}`}
                                className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${isDark ? "bg-white/5 text-white/80 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                            >
                                <Bot size={16} /> Open chat
                            </Link>
                        </div>
                    </div>

                    {/* Suggestion */}
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                        <Sparkles size={20} className={`shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                        <div>
                            <p className={`text-sm font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>Suggestion for {meta.name}</p>
                            <p className={`text-sm ${isDark ? "text-amber-200/80" : "text-amber-700/80"}`}>{meta.suggestion}</p>
                        </div>
                    </div>

                    <PineconeDocuments
                        namespace={agentMemoryNamespace}
                        agentKey={agent}
                        useDefaultNamespace={isDedicatedIndex}
                        isDark={isDark}
                        query={query}
                    />
                </div>
            )}
        </KbShell>
    )
}
