"use server"

export async function uploadFilesToPinecone(filesData: { name: string; content: string }[], namespace: string) {
  console.log("[v0] Server: Processing files for Pinecone...")

  const openaiKey = process.env.NEXT_PUBLIC_OPENAI_KEY
  const pineconeHost = process.env.NEXT_PUBLIC_PINECONE_HOST
  const pineconeApiKey = process.env.NEXT_PUBLIC_PINECONE_API_KEY
  const openaiModel = process.env.NEXT_PUBLIC_OPENAI_MODEL || "text-embedding-3-small"

  if (!openaiKey) throw new Error("OpenAI API key not configured")
  if (!pineconeHost || !pineconeApiKey) throw new Error("Pinecone configuration missing")

  for (const fileData of filesData) {
    try {
      console.log(`[v0] Server: Creating embedding for: ${fileData.name}`)

      // Create embedding
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          input: fileData.content,
        }),
      })

      if (!embeddingResponse.ok) {
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`)
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.data[0].embedding

      // Upsert to Pinecone
      const fileId = `${namespace}_${fileData.name}_${Date.now()}`
      console.log(`[v0] Server: Upserting to Pinecone with ID: ${fileId}`)

      const pineconeResponse = await fetch(`https://${pineconeHost}/vectors/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": pineconeApiKey,
        },
        body: JSON.stringify({
          vectors: [
            {
              id: fileId,
              values: embedding,
              metadata: {
                fileName: fileData.name,
                text: fileData.content.substring(0, 40000),
                uploadedAt: new Date().toISOString(),
                namespace: namespace,
              },
            },
          ],
          namespace: namespace,
        }),
      })

      if (!pineconeResponse.ok) {
        const error = await pineconeResponse.text()
        throw new Error(`Pinecone upsert failed: ${error}`)
      }

      console.log(`[v0] Server: Successfully uploaded: ${fileData.name}`)
    } catch (error) {
      console.error(`[v0] Server: Error processing file ${fileData.name}:`, error)
      throw error
    }
  }

  console.log("[v0] Server: All files processed successfully!")
  return { success: true }
}
