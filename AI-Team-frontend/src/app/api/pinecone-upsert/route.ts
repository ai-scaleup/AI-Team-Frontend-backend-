import { NextRequest, NextResponse } from "next/server"

async function getEmbedding(text: string, apiKey: string, model: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: text,
            model: model,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        console.error("[pinecone-upsert] OpenAI embedding error:", response.status, error)
        throw new Error(`OpenAI embedding failed (${response.status}): ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
}

async function upsertToPinecone(vectors: any[], namespace: string, host: string, apiKey: string): Promise<boolean> {
    const url = `${host}/vectors/upsert`

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
        },
        body: JSON.stringify({
            vectors,
            namespace,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        console.error("[pinecone-upsert] Pinecone upsert error:", response.status, error)
        throw new Error(`Pinecone upsert failed (${response.status}): ${error}`)
    }

    return true
}

export async function POST(req: NextRequest) {
    try {
        // Read env vars inside handler to ensure they're available
        const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ""
        const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || process.env.OPENAI_MODEL || "text-embedding-3-large"
        const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST || process.env.PINECONE_HOST || ""
        const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY || process.env.PINECONE_API_KEY || ""

        console.log("[pinecone-upsert] ENV check - OPENAI_API_KEY:", OPENAI_API_KEY ? `set (${OPENAI_API_KEY.substring(0, 10)}...)` : "MISSING")
        console.log("[pinecone-upsert] ENV check - PINECONE_HOST:", PINECONE_HOST ? `set (${PINECONE_HOST.substring(0, 30)}...)` : "MISSING")
        console.log("[pinecone-upsert] ENV check - PINECONE_API_KEY:", PINECONE_API_KEY ? `set (${PINECONE_API_KEY.substring(0, 10)}...)` : "MISSING")

        if (!OPENAI_API_KEY || !PINECONE_HOST || !PINECONE_API_KEY) {
            const missing = []
            if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY")
            if (!PINECONE_HOST) missing.push("PINECONE_HOST")
            if (!PINECONE_API_KEY) missing.push("PINECONE_API_KEY")
            return NextResponse.json(
                { error: `Missing API credentials: ${missing.join(", ")}` },
                { status: 500 }
            )
        }

        const body = await req.json()
        const { type } = body
        console.log("[pinecone-upsert] Request type:", type, "body keys:", Object.keys(body))

        // --- UPSERT CONVERSATION ---
        if (type === "conversation") {
            const { userText, aiText, chatId, agentId, namespace } = body

            const missingFields = []
            if (!userText) missingFields.push("userText")
            if (!aiText) missingFields.push("aiText")
            if (!chatId) missingFields.push("chatId")
            if (!agentId) missingFields.push("agentId")
            if (!namespace) missingFields.push("namespace")

            if (missingFields.length > 0) {
                console.error("[pinecone-upsert] Missing fields:", missingFields)
                return NextResponse.json(
                    { error: `Missing required fields: ${missingFields.join(", ")}` },
                    { status: 400 }
                )
            }

            const timestamp = Date.now()

            const [userEmbedding, aiEmbedding] = await Promise.all([
                getEmbedding(userText, OPENAI_API_KEY, OPENAI_MODEL),
                getEmbedding(aiText, OPENAI_API_KEY, OPENAI_MODEL),
            ])

            const vectors = [
                {
                    id: `${chatId}_user_${timestamp}`,
                    values: userEmbedding,
                    metadata: {
                        text: userText,
                        sender: "user",
                        timestamp: new Date().toISOString(),
                        chatId,
                        agentId,
                        namespace,
                    },
                },
                {
                    id: `${chatId}_ai_${timestamp}`,
                    values: aiEmbedding,
                    metadata: {
                        text: aiText,
                        sender: "ai",
                        timestamp: new Date().toISOString(),
                        chatId,
                        agentId,
                        namespace,
                    },
                },
            ]

            await upsertToPinecone(vectors, namespace, PINECONE_HOST, PINECONE_API_KEY)
            console.log("[pinecone-upsert] ✅ Conversation upserted successfully")
            return NextResponse.json({ success: true })
        }

        // --- UPSERT FILE ---
        if (type === "file") {
            const { fileName, content, namespace, chatId, agentId } = body
            if (!fileName || !content || !namespace) {
                return NextResponse.json(
                    { error: `Missing required fields for file upsert: fileName=${!!fileName}, content=${!!content}, namespace=${!!namespace}` },
                    { status: 400 }
                )
            }

            const timestamp = Date.now()
            const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
            const maxChunkSize = 8000
            const chunks: string[] = []

            if (content.length <= maxChunkSize) {
                chunks.push(content)
            } else {
                const paragraphs = content.split(/\n\n+/)
                let currentChunk = ""
                for (const para of paragraphs) {
                    if (currentChunk.length + para.length > maxChunkSize) {
                        if (currentChunk) chunks.push(currentChunk.trim())
                        currentChunk = para
                    } else {
                        currentChunk += (currentChunk ? "\n\n" : "") + para
                    }
                }
                if (currentChunk) chunks.push(currentChunk.trim())
            }

            const vectors = []
            for (let i = 0; i < chunks.length; i++) {
                const embedding = await getEmbedding(chunks[i], OPENAI_API_KEY, OPENAI_MODEL)
                const vectorId =
                    chunks.length === 1
                        ? `file_${cleanFileName}_${timestamp}`
                        : `file_${cleanFileName}_${timestamp}_part${i + 1}`

                vectors.push({
                    id: vectorId,
                    values: embedding,
                    metadata: {
                        text: chunks[i],
                        sender: "file",
                        timestamp: new Date().toISOString(),
                        chatId: chatId || "",
                        agentId: agentId || "",
                        namespace,
                        fileName,
                        fileType: fileName.split(".").pop() || "unknown",
                        chunkIndex: i,
                        totalChunks: chunks.length,
                    },
                })
            }

            await upsertToPinecone(vectors, namespace, PINECONE_HOST, PINECONE_API_KEY)
            console.log("[pinecone-upsert] ✅ File upserted successfully:", fileName)
            return NextResponse.json({ success: true, indexed: chunks.length })
        }

        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })
    } catch (error: any) {
        console.error("[pinecone-upsert] Error:", error.message)
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}
