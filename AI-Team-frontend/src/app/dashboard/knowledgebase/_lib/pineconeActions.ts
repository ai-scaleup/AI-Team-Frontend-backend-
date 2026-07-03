"use server"

// Server-side Pinecone reads/deletes for the knowledgebase page.
//
// These MUST run on the server: Pinecone's data-plane API does not send CORS
// headers, so calling `/vectors/list` or `/vectors/delete` straight from the
// browser fails with a generic "fetch failed". The upload flow already goes
// through a server action for the same reason (see components/actions/
// upload-to-pinecone).

import type { PineconeDoc } from "./pineconeKb"
import {
    deleteVectorIds as deleteVectorIdsFromPinecone,
    listNamespaceDocuments as listPineconeNamespaceDocuments,
} from "./pineconeServer"

/** List the uploaded documents (one row per file) for a namespace. */
export async function listNamespaceDocuments(namespace: string): Promise<PineconeDoc[]> {
    return listPineconeNamespaceDocuments(namespace)
}

/** Delete a set of vector ids (i.e. one document) from a namespace. */
export async function deleteVectorIds(namespace: string, ids: string[]): Promise<void> {
    await deleteVectorIdsFromPinecone(namespace, ids)
}
