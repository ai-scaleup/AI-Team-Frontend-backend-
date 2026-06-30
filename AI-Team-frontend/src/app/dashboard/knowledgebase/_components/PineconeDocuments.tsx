"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, FileText, RefreshCw, Loader2, AlertCircle, Layers } from "lucide-react"
import { listNamespaceDocuments, PineconeDoc } from "../_lib/pineconeKb"

/**
 * Read-only list of everything actually uploaded to the user's Pinecone
 * namespace. Rendered alongside the existing mock sections — it never mutates
 * Pinecone, it only shows what is there.
 */
export default function PineconeDocuments({
    namespace,
    isDark,
    query = "",
}: {
    namespace: string
    isDark: boolean
    query?: string
}) {
    const [docs, setDocs] = useState<PineconeDoc[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!namespace) return
        setLoading(true)
        setError(null)
        try {
            setDocs(await listNamespaceDocuments(namespace))
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load documents")
        } finally {
            setLoading(false)
        }
    }, [namespace])

    useEffect(() => {
        load()
    }, [load])

    const visible = query.trim() === "" ? docs : docs.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))

    if (!namespace) {
        return (
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${isDark ? "bg-[#0F172A] border-white/5 text-white/60" : "bg-white border-gray-200 text-gray-500 shadow-sm"}`}>
                <AlertCircle size={18} className="shrink-0 text-amber-500" />
                <p className="text-sm">No <span className="font-mono">sharedNamespaceId</span> in the URL, so there is no namespace to read from Pinecone.</p>
            </div>
        )
    }

    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>
                        <Database size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Uploaded to Pinecone</h3>
                        <p className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                            {loading ? "Loading…" : `${docs.length} document${docs.length === 1 ? "" : "s"}`} in namespace{" "}
                            <span className="font-mono">{namespace}</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    title="Refresh"
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? "hover:bg-white/10 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-4">
                {loading && docs.length === 0 ? (
                    <div className={`flex items-center justify-center gap-2 py-10 text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        <Loader2 size={16} className="animate-spin" /> Reading namespace…
                    </div>
                ) : error ? (
                    <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDark ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700"}`}>
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">Couldn&apos;t load documents</p>
                            <p className="text-xs break-words opacity-80">{error}</p>
                        </div>
                    </div>
                ) : visible.length === 0 ? (
                    <div className={`py-10 text-center text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
                        {docs.length === 0 ? "This namespace has no documents yet." : "No documents match your search."}
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {visible.map(doc => (
                            <li
                                key={doc.docId}
                                className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${isDark ? "bg-[#1E293B] border-white/5" : "bg-gray-50 border-gray-200"}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? "bg-white/5 text-indigo-400" : "bg-white text-indigo-600"}`}>
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>{doc.name}</p>
                                        <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>Uploaded {doc.uploadedAt}</p>
                                    </div>
                                </div>
                                <span
                                    title={`${doc.chunks} vector${doc.chunks === 1 ? "" : "s"} in Pinecone`}
                                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDark ? "bg-white/5 text-white/60" : "bg-white text-gray-600 border border-gray-200"}`}
                                >
                                    <Layers size={12} /> {doc.chunks}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
