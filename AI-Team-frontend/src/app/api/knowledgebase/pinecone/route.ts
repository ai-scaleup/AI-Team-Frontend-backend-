import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import {
    deleteVectorIds,
    listNamespaceDocuments,
    upsertTextRecords,
    type PineconeIndexKind,
} from "@/app/dashboard/knowledgebase/_lib/pineconeServer"

export const dynamic = "force-dynamic"

type PineconeMetadataValue = string | number | boolean | string[] | null | undefined
type AuthorizedPineconeTarget = {
    kind: PineconeIndexKind
    namespace: string
    agentKey?: string
}

function sanitizeMetadata(metadata: unknown): Record<string, PineconeMetadataValue> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}

    const cleaned: Record<string, PineconeMetadataValue> = {}
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

function cleanAgentKey(agent: unknown): string {
    return typeof agent === "string" && /^[a-z0-9-]+$/.test(agent.trim()) ? agent.trim() : ""
}

const DEDICATED_KINDS: Record<string, PineconeIndexKind> = {
    "chiara-ai": "chiara",
    "jennifer-ai": "jennifer",
}

function isDedicatedAgent(agent: unknown): boolean {
    return Boolean(DEDICATED_KINDS[cleanAgentKey(agent)])
}

async function authorizeNamespace(namespace: string, agent?: string): Promise<AuthorizedPineconeTarget | NextResponse> {
    const { userId } = await auth()
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const agentKey = cleanAgentKey(agent)
    const dedicatedKind = DEDICATED_KINDS[agentKey]
    const expectedNamespace = dedicatedKind ? "" : agentKey ? `${userId}-${agentKey}` : userId
    if (namespace !== expectedNamespace) {
        return NextResponse.json({ error: "Forbidden namespace" }, { status: 403 })
    }

    return {
        kind: dedicatedKind ?? (agentKey ? "agent-memory" : "shared"),
        namespace,
        agentKey: agentKey || undefined,
    }
}

export async function GET(request: NextRequest) {
    const namespace = request.nextUrl.searchParams.get("namespace")?.trim() ?? ""
    const agent = request.nextUrl.searchParams.get("agent")?.trim()
    if (!namespace && !isDedicatedAgent(agent)) {
        return NextResponse.json({ error: "Missing namespace" }, { status: 400 })
    }

    const target = await authorizeNamespace(namespace, agent)
    if (target instanceof NextResponse) return target

    try {
        const documents = await listNamespaceDocuments(target.namespace, target.kind)
        return NextResponse.json({ documents })
    } catch (error) {
        console.error("[knowledgebase/pinecone] list failed:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load Pinecone documents" },
            { status: 500 },
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const namespace = typeof body?.namespace === "string" ? body.namespace.trim() : ""
        const agent = typeof body?.agent === "string" ? body.agent.trim() : ""
        const records: unknown[] = Array.isArray(body?.records) ? body.records : []

        if (!namespace && !isDedicatedAgent(agent)) {
            return NextResponse.json({ error: "Missing namespace" }, { status: 400 })
        }
        if (records.length === 0) {
            return NextResponse.json({ error: "Missing records" }, { status: 400 })
        }

        const target = await authorizeNamespace(namespace, agent)
        if (target instanceof NextResponse) return target

        const validRecords = records
            .filter((record: unknown): record is { id: string; text: string; metadata?: Record<string, unknown> } => {
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

        await upsertTextRecords(target.namespace, validRecords, target.kind)
        return NextResponse.json({ success: true, count: validRecords.length })
    } catch (error) {
        console.error("[knowledgebase/pinecone] upsert failed:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to upsert Pinecone records" },
            { status: 500 },
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const namespace = typeof body?.namespace === "string" ? body.namespace.trim() : ""
        const agent = typeof body?.agent === "string" ? body.agent.trim() : ""
        const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string") : []

        if (!namespace && !isDedicatedAgent(agent)) {
            return NextResponse.json({ error: "Missing namespace" }, { status: 400 })
        }
        if (ids.length === 0) {
            return NextResponse.json({ error: "Missing vector ids" }, { status: 400 })
        }

        const target = await authorizeNamespace(namespace, agent)
        if (target instanceof NextResponse) return target

        await deleteVectorIds(target.namespace, ids, target.kind)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[knowledgebase/pinecone] delete failed:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete Pinecone document" },
            { status: 500 },
        )
    }
}
