// Helpers to read the "uploaded documents" of a Pinecone namespace straight
// from the browser, reusing the same NEXT_PUBLIC_* credentials the agent
// dashboards already use to upsert/query Pinecone.
//
// Vector ids are written as `${fileName}:${Date.now()}#${chunkIndex}` (see
// components/actions/indexFilesToPinecone), so every uploaded file spreads
// across many vectors that share the `${fileName}:${timestamp}` prefix. We
// list the ids, regroup them by that prefix and surface one row per document.

const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST
const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY

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
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

/** Regroup raw vector ids into one entry per uploaded document. */
export function groupVectorIds(ids: string[]): PineconeDoc[] {
    const byDoc = new Map<string, { name: string; ms: number | null; chunks: number }>()

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
        if (existing) existing.chunks += 1
        else byDoc.set(docId, { name, ms, chunks: 1 })
    }

    const docs: PineconeDoc[] = []
    byDoc.forEach((entry, docId) => {
        docs.push({
            docId,
            name: entry.name,
            uploadedMs: entry.ms,
            uploadedAt: entry.ms ? formatDate(entry.ms) : "—",
            chunks: entry.chunks,
        })
    })

    // newest upload first; documents without a timestamp sink to the bottom
    docs.sort((a, b) => (b.uploadedMs ?? 0) - (a.uploadedMs ?? 0))
    return docs
}

/** List every vector id stored under a namespace, following pagination. */
export async function listNamespaceVectorIds(namespace: string): Promise<string[]> {
    if (!PINECONE_HOST || !PINECONE_API_KEY) throw new Error("Pinecone is not configured")
    if (!namespace) return []

    const ids: string[] = []
    let paginationToken: string | undefined

    // Hard cap on pages so a malformed token can never loop forever.
    for (let page = 0; page < 200; page++) {
        const url = new URL(`${PINECONE_HOST}/vectors/list`)
        url.searchParams.set("namespace", namespace)
        url.searchParams.set("limit", "100")
        if (paginationToken) url.searchParams.set("paginationToken", paginationToken)

        const res = await fetch(url.toString(), {
            method: "GET",
            headers: { "Api-Key": PINECONE_API_KEY },
        })
        if (!res.ok) throw new Error(`Pinecone list failed: ${res.status}`)

        const data = await res.json()
        for (const v of data?.vectors ?? []) {
            if (v?.id) ids.push(v.id as string)
        }

        paginationToken = data?.pagination?.next
        if (!paginationToken) break
    }

    return ids
}

/** List the uploaded documents (one row per file) for a namespace. */
export async function listNamespaceDocuments(namespace: string): Promise<PineconeDoc[]> {
    const ids = await listNamespaceVectorIds(namespace)
    return groupVectorIds(ids)
}
