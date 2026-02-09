/**
 * Script to upsert business-ai landing page content to Pinecone
 * Run with: npx tsx scripts/upsert-business-ai.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

const BUSINESS_AI_CONTENT = `NON REGALARE IL SOLITO OGGETTO. REGALA IL FUTURO!

Aiuta i tuoi cari a Lanciare (o RI-lanciare) la loro attività/azienda grazie alla Consulenza di 10 Agenti professionisti AI, alla formazione ed al Coaching 1-1 degli esperti (umani) di Digital Coach®, la migliore Scuola Italiana di formazione sull'Intelligenza Artificiale.

VANTAGGIO FISCALE PER P.IVA: Scarica il 100% come Formazione + Detrai IVA 22%

BOX START €97: Videocorso AI Power, 2 Sessioni Coaching con esperto umano, 3 Giorni Accesso a 5 Agenti, 1 Ticket Evento Live di 3 serate (Valore €380).

BOX PREMIUM €197 (Il Regalo Più Venduto): Videocorso AI Power, 3 Sessioni Coaching (+1 rispetto alla Start), 10 Giorni Accesso AI Agents (+7 Giorni Extra e Accesso FULL), 2 Ticket Evento Experience (RADDOPPIATO! Valore €760), BONUS Corso LinkedIn ESCLUSIVA PREMIUM.

HAI PARTITA IVA? IL BOX SI RIPAGA DA SOLO: Se il tuo regime fiscale lo consente, richiedendo la fattura risparmi il 22% detraendo l'IVA e in più deduci il 100% del costo come spesa in Formazione o Software.

AI TEAM - I NUOVI DIPENDENTI: Aladino AI (esperto innovazione), Mike AI (Marketing Manager), Daniele AI (Copywriter), Lara AI (Social Media Manager), Alex AI (ADS Manager). BOX Premium include anche: Tony AI (Consulente vendite), Jim AI (Coach vendita), Niko AI (SEO Manager), Simone AI (Copywriter SEO), Valentina AI.

VIDEOCORSO AI POWER: Corso di Luca Papa, esperto italiano di applicazioni AI aziendali per marketing e vendite. Guida per sfruttare la Rivoluzione AI.

COACHING 1-1 HUMAN-TO-HUMAN: Sessioni 1-to-1 con esperto che analizza la tua attività e spiega come l'AI può aiutarti nel tuo caso specifico.

AI TEAM EXPERIENCE (EVENTO LIVE): Evento formativo con Luca Papa, 3 serate online, pratica reale con AI Agents. Valore €380 a biglietto. BOX Premium include 2 ticket.

LINK ACQUISTO: Box Start €97: https://members.digital-coach.com/offers/ZYARvHAZ/checkout | Box Premium €197: https://members.digital-coach.com/offers/yMpKZou6/checkout`;

async function upsertToBusinessAI() {
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST;
    const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY;
    const NAMESPACE = process.env.NEXT_PUBLIC_BUSINESS_NAMESPACE || 'business-ai';

    if (!OPENAI_API_KEY || !PINECONE_HOST || !PINECONE_API_KEY) {
        console.error('Missing environment variables');
        console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? 'set' : 'missing');
        console.log('PINECONE_HOST:', PINECONE_HOST ? 'set' : 'missing');
        console.log('PINECONE_API_KEY:', PINECONE_API_KEY ? 'set' : 'missing');
        process.exit(1);
    }

    console.log(`Upserting to namespace: ${NAMESPACE}`);
    console.log(`Content length: ${BUSINESS_AI_CONTENT.length} chars`);

    try {
        // Create embedding for the entire content (it's small enough)
        console.log('Creating embedding...');
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-large',
                input: BUSINESS_AI_CONTENT,
            }),
        });

        if (!embeddingResponse.ok) {
            const errorText = await embeddingResponse.text();
            console.error('OpenAI API error:', errorText);
            process.exit(1);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        console.log(`Embedding created with ${embedding.length} dimensions`);

        // Prepare vector
        const vectorId = `business-ai-landing-${Date.now()}`;
        const vector = {
            id: vectorId,
            values: embedding,
            metadata: {
                text: BUSINESS_AI_CONTENT,
                source: 'business-ai-landing-page',
                namespace: NAMESPACE,
                uploaded_at: new Date().toISOString(),
            },
        };

        // Upsert to Pinecone
        console.log('Upserting to Pinecone...');
        const pineconeResponse = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': PINECONE_API_KEY,
            },
            body: JSON.stringify({
                vectors: [vector],
                namespace: NAMESPACE,
            }),
        });

        if (!pineconeResponse.ok) {
            const errorText = await pineconeResponse.text();
            console.error('Pinecone error:', errorText);
            process.exit(1);
        }

        const result = await pineconeResponse.json();
        console.log('✅ Successfully upserted to Pinecone!');
        console.log('Result:', JSON.stringify(result, null, 2));
        console.log(`Namespace: ${NAMESPACE}`);
        console.log(`Vector ID: ${vectorId}`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

upsertToBusinessAI();
