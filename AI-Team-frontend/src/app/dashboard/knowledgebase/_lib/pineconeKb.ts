// Pure, client-safe helpers for turning raw Pinecone vector ids into one row
// per uploaded document. The actual network calls (list/delete) live in
// ./pineconeActions and run on the server, because Pinecone's data-plane API
// does not send CORS headers.
//
// Vector ids are written as `${fileName}:${Date.now()}#${chunkIndex}` (see
// components/actions/indexFilesToPinecone), so every uploaded file spreads
// across many vectors that share the `${fileName}:${timestamp}` prefix. We
// list the ids, regroup them by that prefix and surface one row per document.

export type PineconeDoc = {
    /** stable id for the document (the `name:timestamp` prefix, or the raw id) */
    docId: string
    /** original file name */
    name: string
    /** upload date in ms (parsed from the id), or null when not encoded */
    uploadedMs: number | null
    /** human readable upload date */
    uploadedAt: string
    /** how many vectors/chunks belong to this document */
    chunks: number
    /** the raw Pinecone vector ids that make up this document (used to delete it) */
    ids: string[]
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

/** Regroup raw vector ids into one entry per uploaded document. */
export function groupVectorIds(ids: string[]): PineconeDoc[] {
    const byDoc = new Map<string, { name: string; ms: number | null; ids: string[] }>()

    for (const id of ids) {
        // Preferred format: "<file name>:<timestamp>#<chunk index>"
        const match = id.match(/^(.*):(\d{10,})#\d+$/)
        let docId: string
        let name: string
        let ms: number | null

        if (match) {
            name = match[1]
            ms = Number(match[2])
            docId = `${name}:${match[2]}`
        } else {
            // Fallback: drop a trailing "#<n>" chunk suffix if present
            docId = id.replace(/#\d+$/, "")
            name = docId
            ms = null
        }

        const existing = byDoc.get(docId)
        if (existing) existing.ids.push(id)
        else byDoc.set(docId, { name, ms, ids: [id] })
    }

    const docs: PineconeDoc[] = []
    byDoc.forEach((entry, docId) => {
        docs.push({
            docId,
            name: entry.name,
            uploadedMs: entry.ms,
            uploadedAt: entry.ms ? formatDate(entry.ms) : "N/A",
            chunks: entry.ids.length,
            ids: entry.ids,
        })
    })

    // newest upload first; documents without a timestamp sink to the bottom
    docs.sort((a, b) => (b.uploadedMs ?? 0) - (a.uploadedMs ?? 0))
    return docs
}
