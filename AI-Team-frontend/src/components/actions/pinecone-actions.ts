"use server"

export async function indexFilesToPinecone(
  filesData: { name: string; content: string; size: number; type: string }[],
  namespace: string,
  chatId: string,
) {
  const PINECONE_HOST = process.env.PINECONE_HOST || ""
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY || ""
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "text-embedding-3-small"

  if (!PINECONE_HOST || !PINECONE_API_KEY || !OPENAI_API_KEY) {
    console.warn("Pinecone or OpenAI credentials missing")
    return { success: false, error: "Missing credentials" }
  }

  const chunkSmart = (text: string, maxLen: number, overlap: number) => {
    const chunks: string[] = []
    let start = 0
    while (start < text.length) {
      const end = Math.min(start + maxLen, text.length)
      chunks.push(text.slice(start, end))
      start = end - overlap
      if (start >= text.length) break
    }
    return chunks
  }

  const embedBatch = async (texts: string[]): Promise<number[][]> => {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: texts,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI batch embedding error: ${response.status}`)
    }

    const data = await response.json()
    return data.data.map((d: any) => d.embedding)
  }

  const upsertVectors = async (vectors: any[]) => {
    const response = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PINECONE_API_KEY,
      },
      body: JSON.stringify({
        vectors,
        namespace,
      }),
    })

    if (!response.ok) {
      throw new Error(`Pinecone upsert error: ${response.status}`)
    }

    return await response.json()
  }

  try {
    const nowIso = new Date().toISOString()
    const all: any[] = []

    for (const file of filesData) {
      if (!file.content.trim()) continue

      const chunks = chunkSmart(file.content, 1000, 200)
      const docId = `${file.name}:${Date.now()}`

      chunks.forEach((c, i) =>
        all.push({
          id: `${docId}#${i}`,
          text: c,
          metadata: {
            text: c,
            file_name: file.name,
            doc_id: docId,
            chunk_index: i,
            source: file.type,
            size_bytes: file.size,
            uploaded_at: nowIso,
            app: "MikeAI-Uploader",
            chat_id: chatId,
          },
        }),
      )
    }

    if (!all.length) return { success: true, indexed: 0 }

    let totalIndexed = 0
    // Process in batches of 100
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100)
      const embs = await embedBatch(batch.map((d) => d.text))
      const vecs = batch.map((d, idx) => ({
        id: d.id,
        values: embs[idx],
        metadata: d.metadata,
      }))
      await upsertVectors(vecs)
      totalIndexed += batch.length
    }

    return { success: true, indexed: totalIndexed }
  } catch (error: any) {
    console.error("Error indexing to Pinecone:", error)
    return { success: false, error: error.message }
  }
}
