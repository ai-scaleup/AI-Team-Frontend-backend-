"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Database, FileText, RefreshCw, Loader2, AlertCircle, Layers, Upload, Trash2 } from "lucide-react"
import { PineconeDoc } from "../_lib/pineconeKb"
import { extractFileContent } from "@/utils/fileExtraction"

async function readApiError(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json()
        return typeof data?.error === "string" ? data.error : fallback
    } catch {
        return fallback
    }
}

/**
 * Read-only list of everything actually uploaded to the user's Pinecone
 * namespace. Rendered alongside the existing mock sections - it never mutates
 * Pinecone, it only shows what is there.
 */
export default function PineconeDocuments({
    namespace,
    isDark,
    query = "",
    agentKey,
    useDefaultNamespace = false,
    apiEndpoint = "/api/knowledgebase/pinecone",
    adminTargetUserId,
}: {
    namespace: string
    isDark: boolean
    query?: string
    agentKey?: string
    useDefaultNamespace?: boolean
    apiEndpoint?: string
    adminTargetUserId?: string
}) {
    const [docs, setDocs] = useState<PineconeDoc[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const load = useCallback(async () => {
        if (!namespace && !useDefaultNamespace) return
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({ namespace })
            if (agentKey) params.set("agent", agentKey)
            if (adminTargetUserId) params.set("targetUserId", adminTargetUserId)
            const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
            })
            if (!res.ok) throw new Error(await readApiError(res, `Failed to load documents (${res.status})`))
            const data = await res.json()
            setDocs(Array.isArray(data?.documents) ? data.documents : [])
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load documents")
        } finally {
            setLoading(false)
        }
    }, [namespace, agentKey, useDefaultNamespace, apiEndpoint, adminTargetUserId])

    useEffect(() => {
        load()
    }, [load])

    const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ""
        if (files.length === 0 || (!namespace && !useDefaultNamespace)) return

        setUploading(true)
        setError(null)
        try {
            const records: {
                id: string
                text: string
                metadata: Record<string, string | number | boolean>
            }[] = []
            for (const file of files) {
                const content = await extractFileContent(file)
                if (content && content.trim()) {
                    const uploadedAt = new Date().toISOString()
                    const docId = `${file.name}:${Date.now()}`
                    records.push({
                        id: `${docId}#0`,
                        text: content,
                        metadata: {
                            fileName: file.name,
                            uploadedAt,
                            namespace,
                            ...(agentKey ? { "agent-memory": namespace, agent: agentKey } : {}),
                        },
                    })
                }
            }
            if (records.length === 0) throw new Error("Couldn't extract any text from the selected file(s)")

            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ namespace, agent: agentKey, targetUserId: adminTargetUserId, records }),
            })
            if (!res.ok) throw new Error(await readApiError(res, `Upload failed (${res.status})`))
            await load()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Upload failed")
        } finally {
            setUploading(false)
        }
    }, [namespace, agentKey, load, useDefaultNamespace, apiEndpoint, adminTargetUserId])

    const handleDelete = useCallback(async (doc: PineconeDoc) => {
        if (!namespace && !useDefaultNamespace) return
        if (!window.confirm(`Delete "${doc.name}" from Pinecone? This can't be undone.`)) return

        setDeletingId(doc.docId)
        setError(null)
        try {
            const res = await fetch(apiEndpoint, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ namespace, agent: agentKey, targetUserId: adminTargetUserId, ids: doc.ids }),
            })
            if (!res.ok) throw new Error(await readApiError(res, `Delete failed (${res.status})`))
            setDocs(prev => prev.filter(d => d.docId !== doc.docId))
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Delete failed")
        } finally {
            setDeletingId(null)
        }
    }, [namespace, agentKey, useDefaultNamespace, apiEndpoint, adminTargetUserId])

    // Chat transcripts are synced into Pinecone under `chat_*` doc ids purely
    // for agent memory - they aren't user-managed knowledge base documents, so
    // hide them from this list.
    const documents = docs.filter(d => !d.name.startsWith("chat_"))
    const visible = query.trim() === "" ? documents : documents.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))

    if (!namespace && !useDefaultNamespace) {
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
                            {loading ? "Loading..." : `${documents.length} document${documents.length === 1 ? "" : "s"}`} in namespace{" "}
                            <span className="font-mono">{namespace || "default"}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.html,.htm,.md,.txt"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={`px-3 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all disabled:opacity-60 ${isDark
                            ? "bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25"
                            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                            }`}
                    >
                        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                        <span className="hidden sm:inline">{uploading ? "Uploading..." : "Upload"}</span>
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        title="Refresh"
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? "hover:bg-white/10 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <div className="p-4">
                {loading && docs.length === 0 ? (
                    <div className={`flex items-center justify-center gap-2 py-10 text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        <Loader2 size={16} className="animate-spin" /> Reading namespace...
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
                        {documents.length === 0 ? "This namespace has no documents yet." : "No documents match your search."}
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
                                <div className="flex items-center gap-2 shrink-0">
                                    <span
                                        title={`${doc.chunks} vector${doc.chunks === 1 ? "" : "s"} in Pinecone`}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDark ? "bg-white/5 text-white/60" : "bg-white text-gray-600 border border-gray-200"}`}
                                    >
                                        <Layers size={12} /> {doc.chunks}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(doc)}
                                        disabled={deletingId === doc.docId}
                                        title="Delete document"
                                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? "hover:bg-red-500/10 text-white/50 hover:text-red-400" : "hover:bg-red-50 text-gray-500 hover:text-red-600"}`}
                                    >
                                        {deletingId === doc.docId
                                            ? <Loader2 size={16} className="animate-spin" />
                                            : <Trash2 size={16} />}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
