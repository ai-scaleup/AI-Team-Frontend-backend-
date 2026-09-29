import { NextRequest, NextResponse } from "next/server"
import { requireSignedIn } from "@/lib/requireSignedIn"
import {
    upsertTextRecords,
    type PineconeUpsertRecord,
} from "@/app/dashboard/knowledgebase/_lib/pineconeServer"

export const dynamic = "force-dynamic"

// Embedding runs one record at a time; small batches stay inside the
// function's time limit (vercel.json maxDuration), so callers send in batches.
const MAX_RECORDS_PER_REQUEST = 20

type MetadataValue = string | number | boolean | string[] | null | undefined

function sanitizeMetadata(metadata: unknown): Record<string, MetadataValue> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}

    const cleaned: Record<string, MetadataValue> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value == null ||
            (Array.isArray(value) && value.every((item) => typeof item === "string"))
        ) {
            cleaned[key] = value
        }
    }
    return cleaned
}

/**
 * Embeds and upserts chat/file text into the shared Pinecone index on behalf of
 * the agent chat pages, so the OpenAI and Pinecone keys stay on the server.
 */
export async function POST(request: NextRequest) {
    const unauthorized = await requireSignedIn()
    if (unauthorized) return unauthorized

    try {
        const body = await request.json()
        const namespace = typeof body?.namespace === "string" ? body.namespace.trim() : ""
        const records: unknown[] = Array.isArray(body?.records) ? body.records : []

        if (!namespace || namespace.length > 128) {
            return NextResponse.json({ error: "Invalid namespace" }, { status: 400 })
        }
        if (records.length === 0 || records.length > MAX_RECORDS_PER_REQUEST) {
            return NextResponse.json(
                { error: `Send between 1 and ${MAX_RECORDS_PER_REQUEST} records` },
                { status: 400 },
            )
        }

        const validRecords: PineconeUpsertRecord[] = records
            .filter((record: unknown): record is { id: string; text: string; metadata?: unknown } => {
                if (!record || typeof record !== "object") return false
                const value = record as Record<string, unknown>
                return typeof value.id === "string" && typeof value.text === "string"
            })
            .map((record) => ({
                id: record.id,
                text: record.text,
                metadata: sanitizeMetadata(record.metadata),
            }))

        if (validRecords.length === 0) {
            return NextResponse.json({ error: "No valid records to upsert" }, { status: 400 })
        }

        await upsertTextRecords(namespace, validRecords, "shared")
        return NextResponse.json({ success: true, count: validRecords.length })
    } catch (error) {
        console.error("[pinecone/upsert] upsert failed:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to upsert Pinecone records" },
            { status: 500 },
        )
    }
}
