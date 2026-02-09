/**
 * Script to upsert carriera-ai landing page content to Pinecone
 * Run with: npx tsx scripts/upsert-carriera-ai.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

const CARRIERA_AI_CONTENT = `REGALA IL FUTURO - IL PASS PER AVVIARE UNA CARRIERA AI

Basta con i soliti regali. Dona le competenze che le aziende si contenderanno nei prossimi anni! Aiuta i tuoi cari ad avviare una nuova carriera nel mercato dell'INTELLIGENZA ARTIFICIALE che avrà tassi di crescita annui di oltre il 30% da qui al 2033.

Offri loro la formazione, la consulenza di Carriera e il Coaching 1-1 degli esperti (umani) di Digital Coach®, la migliore Scuola Italiana di formazione sull'Intelligenza Artificiale.

VANTAGGIO FISCALE: Hai P.IVA? Scarica il 100% e detrai l'IVA.

REGALO START €97 - Il pensiero che accende la passione: Video corso AI Power per imparare le basi dell'IA, 2 Consulenze di Carriera con Esperto Umano, 1 Biglietto per Evento AI Team Experience (Valore €380).

REGALO PREMIUM €197 (Best Gift 2025) - Per chi vuoi vedere decollare: Videocorso AI Power incluso, Test & Report Analisi Personalità Professionale per trovare la carriera perfetta, Laura AI Career Coach Personale (30gg) assistente dedicata H24, Videocorso LinkedIn per trovare lavoro velocemente, 3 Consulenze 1-1 (+1 rispetto alla Start), 2 Ticket Evento Experience (UNO PER LUI/LEI + UNO PER TE!).

HAI PARTITA IVA? IL REGALO TI COSTA ZERO! Fornendoci i dati di fatturazione puoi scaricare il 100% del costo e recuperare il 22% di IVA se il tuo regime fiscale prevede spese in formazione o software.

COSA CONTIENE IL PACCHETTO REGALO:

LAURA AI - LA SUA NUOVA CONSULENTE DI CARRIERA (SOLO PREMIUM): Accesso per 30 giorni a Laura AI, consulente esperto disponibile 24/7 per comprendere punti di forza, orientare verso lavori ideali, guidare nelle scelte professionali, scrivere il CV perfetto e preparare ai colloqui.

VIDEO CORSO AI POWER: Corso di orientamento con Luca Papa, formatore italiano esperto in ambito tecnologico. Anticipa cosa accadrà nel mondo del lavoro con la Rivoluzione AI. Come cavalcare l'onda AI per migliorare lavoro, stipendio e stile di vita.

MAPPA DELLA PERSONALITÀ & CARRIERA: Test Professionale e Report personalizzato per capire talenti, punti di forza, attitudini e motivazioni. Per avviare una carriera appagante e redditizia.

CONSULENZE PRIVATE 1-1: Sessioni private con esperti umani che analizzano il CV e guidano passo passo. Inclusa strategia LinkedIn per farsi trovare e scegliere dalle aziende.

AI TEAM EXPERIENCE (EVENTO LIVE): Evento formativo con Luca Papa e AI Team, 3 serate online. Con Premium i biglietti sono 2 - puoi partecipare anche tu! Esperienza interattiva con team di 10 agenti professionisti AI.

LINK ACQUISTO: Regalo Start €97: https://members.digital-coach.com/offers/pF8FCd6y/checkout | Regalo Premium €197: https://members.digital-coach.com/offers/K2Dz8dP2/checkout`;

async function upsertToCarrieraAI() {
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST;
    const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY;
    const NAMESPACE = process.env.NEXT_PUBLIC_CARRIERA_NAMESPACE || 'carriera-ai';

    if (!OPENAI_API_KEY || !PINECONE_HOST || !PINECONE_API_KEY) {
        console.error('Missing environment variables');
        console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? 'set' : 'missing');
        console.log('PINECONE_HOST:', PINECONE_HOST ? 'set' : 'missing');
        console.log('PINECONE_API_KEY:', PINECONE_API_KEY ? 'set' : 'missing');
        process.exit(1);
    }

    console.log(`Upserting to namespace: ${NAMESPACE}`);
    console.log(`Content length: ${CARRIERA_AI_CONTENT.length} chars`);

    try {
        // Create embedding for the entire content
        console.log('Creating embedding...');
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-large',
                input: CARRIERA_AI_CONTENT,
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
        const vectorId = `carriera-ai-landing-${Date.now()}`;
        const vector = {
            id: vectorId,
            values: embedding,
            metadata: {
                text: CARRIERA_AI_CONTENT,
                source: 'carriera-ai-landing-page',
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

upsertToCarrieraAI();
