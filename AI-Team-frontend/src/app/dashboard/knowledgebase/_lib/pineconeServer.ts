import { groupVectorIds, type PineconeDoc } from "./pineconeKb"

export type PineconeUpsertRecord = {
    id: string
    text: string
    metadata?: Record<string, string | number | boolean | string[] | null | undefined>
}

export type PineconeIndexKind = "shared" | "agent-memory" | "chiara" | "jennifer"

const DEDICATED_INDEX_NAMES: Partial<Record<PineconeIndexKind, string>> = {
    chiara: "chiara-ai",
    jennifer: "jennifer-ai",
}

const dedicatedHostCache = new Map<string, string>()

/** Resolve the Pinecone base URL + api key, tolerating a host with or without a scheme. */
export async function pineconeConfig(kind: PineconeIndexKind = "shared"): Promise<{ base: string; apiKey: string }> {
    const dedicatedIndexName = DEDICATED_INDEX_NAMES[kind]
    const configuredDedicatedHost = kind === "chiara"
        ? process.env.PINECONE_CHIARA_HOST
        : kind === "jennifer"
            ? process.env.PINECONE_JENNIFER_HOST
            : undefined

    let host = dedicatedIndexName
        ? configuredDedicatedHost
        : kind === "agent-memory"
        ? process.env.PINECONE_AGENT_MEMORY_HOST || process.env.NEXT_PUBLIC_PINECONE_AGENT_MEMORY_HOST
        : process.env.PINECONE_HOST || process.env.NEXT_PUBLIC_PINECONE_HOST

    const apiKey = dedicatedIndexName
        ? process.env.PINECONE_API_KEY || process.env.NEXT_PUBLIC_PINECONE_API_KEY
        : kind === "agent-memory"
        ? process.env.PINECONE_AGENT_MEMORY_API_KEY ||
        process.env.NEXT_PUBLIC_PINECONE_AGENT_MEMORY_API_KEY ||
        process.env.PINECONE_API_KEY ||
        process.env.NEXT_PUBLIC_PINECONE_API_KEY
        : process.env.PINECONE_API_KEY || process.env.NEXT_PUBLIC_PINECONE_API_KEY

    if (!apiKey) throw new Error("Pinecone is not configured")

    if (dedicatedIndexName && !host) {
        host = dedicatedHostCache.get(dedicatedIndexName)
        if (!host) {
            const res = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(dedicatedIndexName)}`, {
                headers: {
                    "Api-Key": apiKey,
                    "X-Pinecone-Api-Version": "2025-10",
                },
                cache: "no-store",
            })
            if (!res.ok) {
                const body = await res.text().catch(() => "")
                throw new Error(`Pinecone index lookup failed: ${res.status}${body ? ` ${body}` : ""}`)
            }
            const data = await res.json()
            if (typeof data?.host !== "string" || !data.host) {
                throw new Error(`Pinecone index ${dedicatedIndexName} did not return a host`)
            }
            const resolvedHost = data.host as string
            host = resolvedHost
            dedicatedHostCache.set(dedicatedIndexName, resolvedHost)
        }
    }

    if (!host) throw new Error("Pinecone host is not configured")

    const base = (host.startsWith("http") ? host : `https://${host}`).replace(/\/+$/, "")
    return { base, apiKey }
}

function openAiConfig(kind: PineconeIndexKind): { apiKey: string; model: string } {
    const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
    const model = kind === "chiara" || kind === "jennifer"
        ? "text-embedding-3-large"
        : process.env.OPENAI_EMBEDDING_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || "text-embedding-3-small"
    if (!apiKey) throw new Error("OpenAI is not configured")
    return { apiKey, model }
}

async function createEmbedding(text: string, kind: PineconeIndexKind): Promise<number[]> {
    const { apiKey, model } = openAiConfig(kind)
    const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
        cache: "no-store",
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`OpenAI embedding failed: ${res.status}${body ? ` ${body}` : ""}`)
    }

    const data = await res.json()
    const embedding = data?.data?.[0]?.embedding
    if (!Array.isArray(embedding)) throw new Error("OpenAI embedding response did not include a vector")
    return embedding
}

/** Embed and upsert arbitrary text records into a user's Pinecone namespace. */
export async function upsertTextRecords(namespace: string, records: PineconeUpsertRecord[], kind: PineconeIndexKind = "shared"): Promise<void> {
    const cleanRecords = records
        .map((record) => ({
            ...record,
            id: record.id.trim(),
            text: record.text.trim(),
        }))
        .filter((record) => record.id && record.text)

    if (cleanRecords.length === 0) return

    const vectors = []
    for (const record of cleanRecords) {
        const embedding = await createEmbedding(record.text, kind)
        vectors.push({
            id: record.id,
            values: embedding,
            metadata: {
                ...(record.metadata ?? {}),
                text: record.text.slice(0, 40000),
                namespace,
            },
        })
    }

    const { base, apiKey } = await pineconeConfig(kind)
    const res = await fetch(`${base}/vectors/upsert`, {
        method: "POST",
        headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(namespace ? { vectors, namespace } : { vectors }),
        cache: "no-store",
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Pinecone upsert failed: ${res.status}${body ? ` ${body}` : ""}`)
    }
}

/** List the uploaded documents (one row per file) for a namespace. */
export async function listNamespaceDocuments(namespace: string, kind: PineconeIndexKind = "shared"): Promise<PineconeDoc[]> {
    const { base, apiKey } = await pineconeConfig(kind)

    const ids: string[] = []
    let paginationToken: string | undefined

    // Hard cap on pages so a malformed token can never loop forever.
    for (let page = 0; page < 200; page++) {
        const url = new URL(`${base}/vectors/list`)
        if (namespace) url.searchParams.set("namespace", namespace)
        url.searchParams.set("limit", "100")
        if (paginationToken) url.searchParams.set("paginationToken", paginationToken)

        const res = await fetch(url.toString(), {
            method: "GET",
            headers: { "Api-Key": apiKey },
            cache: "no-store",
        })
        if (!res.ok) {
            const body = await res.text().catch(() => "")
            throw new Error(`Pinecone list failed: ${res.status}${body ? ` ${body}` : ""}`)
        }

        const data = await res.json()
        for (const v of data?.vectors ?? []) {
            if (v?.id) ids.push(v.id as string)
        }

        paginationToken = data?.pagination?.next
        if (!paginationToken) break
    }

    return groupVectorIds(ids)
}

/** Delete a set of vector ids (i.e. one document) from a namespace. */
export async function deleteVectorIds(namespace: string, ids: string[], kind: PineconeIndexKind = "shared"): Promise<void> {
    if (ids.length === 0) return
    const { base, apiKey } = await pineconeConfig(kind)

    const res = await fetch(`${base}/vectors/delete`, {
        method: "POST",
        headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(namespace ? { ids, namespace } : { ids }),
        cache: "no-store",
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Pinecone delete failed: ${res.status}${body ? ` ${body}` : ""}`)
    }
}
