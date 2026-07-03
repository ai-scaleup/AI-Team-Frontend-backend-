"use client"
export const dynamic = "force-dynamic"

import { useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
    Upload,
    Trash2,
    FileText,
    History,
    Package,
    FolderOpen,
    Sparkles,
    X,
    FileStack,
} from "lucide-react"
import KbShell from "./_components/KbShell"
import PineconeDocuments from "./_components/PineconeDocuments"
import { KB_AGENTS, KbFile, bumpFileVersion } from "./_lib/kbData"

type Section = {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    accent: string
    files: KbFile[]
}

const INITIAL_SECTIONS: Section[] = []

const ACCENTS: Record<string, { dark: string; light: string }> = {
    sky: { dark: "bg-sky-500/10 text-sky-400", light: "bg-sky-100 text-sky-600" },
    emerald: { dark: "bg-emerald-500/10 text-emerald-400", light: "bg-emerald-100 text-emerald-600" },
    fuchsia: { dark: "bg-fuchsia-500/10 text-fuchsia-400", light: "bg-fuchsia-100 text-fuchsia-600" },
    amber: { dark: "bg-amber-500/10 text-amber-400", light: "bg-amber-100 text-amber-600" },
}

export default function SharedKnowledgeBasePage() {
    // sharedNamespaceId passed from the agent dashboards (?sharedNamespaceId=<clerk user id>)
    const sharedNamespaceId = useSearchParams().get("sharedNamespaceId") ?? ""
    const [query, setQuery] = useState("")
    const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS)
    const [historyFile, setHistoryFile] = useState<KbFile | null>(null)
    const uploadTargetRef = useRef<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const triggerUpload = (sectionId: string) => {
        uploadTargetRef.current = sectionId
        fileInputRef.current?.click()
    }

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        const sectionId = uploadTargetRef.current
        if (!file || !sectionId) return
        setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, files: bumpFileVersion(s.files, file) } : s)))
        e.target.value = ""
        uploadTargetRef.current = null
    }

    const deleteFile = (sectionId: string, fileId: string) =>
        setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, files: s.files.filter(f => f.id !== fileId) } : s)))

    const filterFiles = (files: KbFile[]) =>
        query.trim() === "" ? files : files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))

    const totalFiles = sections.reduce((n, s) => n + s.files.length, 0)

    return (
        <KbShell
            active="shared"
            title="Company Info"
            subtitle="Shared memory for all AI Agents on your team"
            search={{ value: query, onChange: setQuery, placeholder: "Search documents..." }}
        >
            {(isDark) => (
                <div className="space-y-6">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Documents", value: totalFiles, icon: <FileStack size={16} /> },
                            { label: "Sections", value: sections.length, icon: <FolderOpen size={16} /> },
                            { label: "Linked agents", value: KB_AGENTS.length, icon: <Sparkles size={16} /> },
                            { label: "Pinecone index", value: "Shared", icon: <Package size={16} /> },
                        ].map((stat, i) => (
                            <div key={i} className={`p-4 rounded-2xl border ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
                                <div className={`mb-2 inline-flex p-2 rounded-lg ${isDark ? "bg-sky-500/10 text-sky-400" : "bg-blue-100 text-blue-600"}`}>{stat.icon}</div>
                                <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stat.value}</p>
                                <p className={`text-[11px] uppercase tracking-wide font-medium ${isDark ? "text-white/40" : "text-gray-500"}`}>{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Live documents actually stored in the user's Pinecone namespace */}
                    <PineconeDocuments namespace={sharedNamespaceId} isDark={isDark} query={query} />

                    {/* Sections */}
                    {sections.map(section => {
                        const files = filterFiles(section.files)
                        const accent = ACCENTS[section.accent]
                        return (
                            <div key={section.id} className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
                                <div className={`p-4 flex items-center justify-between border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isDark ? accent.dark : accent.light}`}>{section.icon}</div>
                                        <div>
                                            <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{section.title}</h3>
                                            <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{section.description}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => triggerUpload(section.id)}
                                        className={`px-3 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${isDark
                                            ? "bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25"
                                            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                                            }`}
                                    >
                                        <Upload size={15} /> <span className="hidden sm:inline">Upload</span>
                                    </button>
                                </div>

                                <div className="p-4">
                                    {files.length === 0 ? (
                                        <button
                                            onClick={() => triggerUpload(section.id)}
                                            className={`w-full py-8 rounded-xl border-2 border-dashed text-sm transition-colors ${isDark ? "border-white/10 text-white/40 hover:border-sky-500/40 hover:text-white/60" : "border-gray-200 text-gray-400 hover:border-blue-300 hover:text-gray-600"}`}
                                        >
                                            Drag or click to upload a document
                                        </button>
                                    ) : (
                                        <ul className="space-y-2">
                                            {files.map(file => (
                                                <FileRow
                                                    key={file.id}
                                                    file={file}
                                                    isDark={isDark}
                                                    onHistory={() => setHistoryFile(file)}
                                                    onDelete={() => deleteFile(section.id, file.id)}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {historyFile && <HistoryModal file={historyFile} isDark={isDark} onClose={() => setHistoryFile(null)} accent="sky" />}
                </div>
            )}
        </KbShell>
    )
}

/* ----------------------------- Shared bits ----------------------------- */

export function FileRow({ file, isDark, onHistory, onDelete }: { file: KbFile; isDark: boolean; onHistory: () => void; onDelete: () => void }) {
    return (
        <li className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${isDark ? "bg-[#1E293B] border-white/5" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${isDark ? "bg-white/5 text-sky-400" : "bg-white text-blue-600"}`}>
                    <FileText size={16} />
                </div>
                <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>{file.name}</p>
                    <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>{file.size} - {file.uploadedAt} - v{file.version}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {file.previousVersions && file.previousVersions.length > 0 && (
                    <button onClick={onHistory} title="Previous versions" className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900"}`}>
                        <History size={16} />
                    </button>
                )}
                <button onClick={onDelete} title="Delete" className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-red-500/10 text-white/50 hover:text-red-400" : "hover:bg-red-50 text-gray-500 hover:text-red-600"}`}>
                    <Trash2 size={16} />
                </button>
            </div>
        </li>
    )
}

export function HistoryModal({ file, isDark, onClose, accent }: { file: KbFile; isDark: boolean; onClose: () => void; accent: "sky" | "indigo" }) {
    const head = accent === "indigo"
        ? (isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700")
        : (isDark ? "bg-sky-500/10 border-sky-500/20 text-sky-300" : "bg-blue-50 border-blue-200 text-blue-700")
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl border p-5 ${isDark ? "bg-[#0F172A] border-white/10" : "bg-white border-gray-200"}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Previous Versions</h3>
                    <button onClick={onClose} className={isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-900"}><X size={18} /></button>
                </div>
                <p className={`text-sm mb-3 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{file.name}</p>
                <ul className="space-y-2">
                    <li className={`flex items-center justify-between p-3 rounded-xl border ${head}`}>
                        <span className="text-sm font-medium">v{file.version} (current)</span>
                        <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>{file.uploadedAt}</span>
                    </li>
                    {file.previousVersions?.map(v => (
                        <li key={v.version} className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? "bg-[#1E293B] border-white/5" : "bg-gray-50 border-gray-200"}`}>
                            <span className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>v{v.version}</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>{v.uploadedAt}</span>
                                <button title="Delete version" className={isDark ? "text-white/40 hover:text-red-400" : "text-gray-400 hover:text-red-600"}><Trash2 size={14} /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
