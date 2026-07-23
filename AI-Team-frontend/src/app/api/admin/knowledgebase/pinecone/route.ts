import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteVectorIds,
  listNamespaceDocuments,
  upsertTextRecords,
  type PineconeIndexKind,
} from "@/app/dashboard/knowledgebase/_lib/pineconeServer";
import { isAdminEmail } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

type PineconeMetadataValue = string | number | boolean | string[] | null | undefined;

const AGENT_KINDS: Record<string, PineconeIndexKind> = {
  "alex-ai": "agent-memory",
  "tony-ai": "agent-memory",
  "mike-ai": "agent-memory",
  "lara-ai": "agent-memory",
  "simone-ai": "agent-memory",
  "aladino-ai": "agent-memory",
  "valentina-ai": "agent-memory",
  "niko-ai": "agent-memory",
  "jim-ai": "agent-memory",
  "daniele-ai": "agent-memory",
  "chiara-ai": "chiara",
  "jennifer-ai": "jennifer",
};

type AdminTarget = {
  kind: PineconeIndexKind;
  namespace: string;
  agentKey?: string;
};

function sanitizeMetadata(metadata: unknown): Record<string, PineconeMetadataValue> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};

  const cleaned: Record<string, PineconeMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

async function requireAdmin(): Promise<NextResponse | null> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emails = user.emailAddresses.map((entry) => entry.emailAddress);
  if (!emails.some(isAdminEmail)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return null;
}

function resolveTarget(userId: unknown, agent: unknown): AdminTarget | NextResponse {
  const cleanUserId = typeof userId === "string" ? userId.trim() : "";
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(cleanUserId)) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  const agentKey = typeof agent === "string" ? agent.trim().toLowerCase() : "";
  if (!agentKey) return { kind: "shared", namespace: cleanUserId };

  const kind = AGENT_KINDS[agentKey];
  if (!kind) return NextResponse.json({ error: "Invalid agent" }, { status: 400 });

  return {
    kind,
    namespace: kind === "chiara" || kind === "jennifer" ? "" : `${cleanUserId}-${agentKey}`,
    agentKey,
  };
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const target = resolveTarget(
    request.nextUrl.searchParams.get("targetUserId"),
    request.nextUrl.searchParams.get("agent"),
  );
  if (target instanceof NextResponse) return target;

  try {
    const documents = await listNamespaceDocuments(target.namespace, target.kind);
    return NextResponse.json({
      documents,
      target: { namespace: target.namespace, agent: target.agentKey ?? null },
    });
  } catch (error) {
    console.error("[admin/knowledgebase/pinecone] list failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load documents" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const target = resolveTarget(body?.targetUserId, body?.agent);
    if (target instanceof NextResponse) return target;

    const records: unknown[] = Array.isArray(body?.records) ? body.records : [];
    const validRecords = records
      .filter((record: unknown): record is { id: string; text: string; metadata?: unknown } => {
        if (!record || typeof record !== "object") return false;
        const value = record as Record<string, unknown>;
        return typeof value.id === "string" && typeof value.text === "string";
      })
      .map((record) => ({
        id: record.id,
        text: record.text,
        metadata: {
          ...sanitizeMetadata(record.metadata),
          managedByAdmin: true,
          targetUserId: String(body.targetUserId),
        },
      }));

    if (validRecords.length === 0) {
      return NextResponse.json({ error: "No valid records to upload" }, { status: 400 });
    }

    await upsertTextRecords(target.namespace, validRecords, target.kind);
    return NextResponse.json({ success: true, count: validRecords.length });
  } catch (error) {
    console.error("[admin/knowledgebase/pinecone] upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload documents" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const target = resolveTarget(body?.targetUserId, body?.agent);
    if (target instanceof NextResponse) return target;

    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing vector ids" }, { status: 400 });
    }

    await deleteVectorIds(target.namespace, ids, target.kind);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/knowledgebase/pinecone] delete failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 },
    );
  }
}
