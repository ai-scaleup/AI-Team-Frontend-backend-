"use client"
export const dynamic = "force-dynamic"

import { useState, useRef, use, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Upload, Sparkles, Bot, FolderOpen } from "lucide-react"
import KbShell from "../_components/KbShell"
import { KB_AGENTS, AGENT_FILES, KbFile, bumpFileVersion } from "../_lib/kbData"
import { FileRow, HistoryModal } from "../page"

export default function AgentKnowledgeBasePage({ params }: { params: Promise<{ agent: string }> }) {
    const { agent } = use(params)
    // sharedNamespaceId passed from the agent dashboards (?sharedNamespaceId=<clerk user id>)
    const sharedNamespaceId = useSearchParams().get("sharedNamespaceId") ?? ""
    const meta = KB_AGENTS.find(a => a.key === agent) ?? { key: agent, name: agent, role: "AI Agent", suggestion: "Upload useful documents for this agent" }

    const [query, setQuery] = useState("")
    const [files, setFiles] = useState<KbFile[]>(AGENT_FILES[agent] ?? [])
    const [historyFile, setHistoryFile] = useState<KbFile | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // TODO: once the backend KB endpoints exist, load this agent's documents for the
    // given user via sharedNamespaceId. Mock data (AGENT_FILES) is used until then.
    useEffect(() => {
        if (!sharedNamespaceId) return
        // fetchAgentDocuments(sharedNamespaceId, agent).then(setFiles)
    }, [sharedNamespaceId, agent])

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFiles(prev => bumpFileVersion(prev, file))
        e.target.value = ""
    }

    const deleteFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))
    const visibleFiles = query.trim() === "" ? files : files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))

    return (
        <KbShell
            active={agent}
            title={`${meta.name} - Agent Info`}
            subtitle={`Dedicated Knowledge Base - ${meta.role}`}
            search={{ value: query, onChange: setQuery, placeholder: "Search documents..." }}
        >
            {(isDark) => (
                <div className="space-y-6">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

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
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${isDark
                                    ? "bg-gradient-to-r from-indigo-500 to-sky-600 hover:from-indigo-400 hover:to-sky-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/25"
                                    }`}
                            >
                                <Upload size={16} /> Upload
                            </button>
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

                    {/* Files */}
                    <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
                        <div className={`p-4 flex items-center gap-3 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                            <div className={`p-2 rounded-lg ${isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>
                                <FolderOpen size={18} />
                            </div>
                            <div>
                                <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Documents</h3>
                                <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{files.length} files in this Pinecone index</p>
                            </div>
                        </div>
                        <div className="p-4">
                            {visibleFiles.length === 0 ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full py-10 rounded-xl border-2 border-dashed text-sm transition-colors ${isDark ? "border-white/10 text-white/40 hover:border-indigo-500/40 hover:text-white/60" : "border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-gray-600"}`}
                                >
                                    No documents for {meta.name}. Click to upload one.
                                </button>
                            ) : (
                                <ul className="space-y-2">
                                    {visibleFiles.map(file => (
                                        <FileRow
                                            key={file.id}
                                            file={file}
                                            isDark={isDark}
                                            onHistory={() => setHistoryFile(file)}
                                            onDelete={() => deleteFile(file.id)}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {historyFile && <HistoryModal file={historyFile} isDark={isDark} onClose={() => setHistoryFile(null)} accent="indigo" />}
                </div>
            )}
        </KbShell>
    )
}
