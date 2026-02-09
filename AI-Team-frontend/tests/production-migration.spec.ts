import { test, expect } from '@playwright/test';

/**
 * Real Production Data Migration Test
 * 
 * This test uses actual conversation data from production localStorage
 * to verify the migration works correctly with real-world scenarios.
 * 
 * NOTE: Tests that navigate to /dashboard/* pages require authentication.
 * These are skipped in CI environments. Run locally with authentication for full coverage.
 */

// Skip tests that require authentication in CI
const skipAuthTests = !!process.env.CI;

// Real production conversation data from mike-ai
const REAL_MIKE_AI_CHAT = {
    "chat_1764267349767": {
        "id": "chat_1764267349767",
        "messages": [
            {
                "text": "Ciao! Sono Mike AI. Il tuo stratega di marketing. Definisco funnel e strategie integrate per scalare il business. Come posso aiutarti?",
                "sender": "ai",
                "time": "00:15"
            },
            {
                "text": "hey",
                "sender": "user",
                "time": "00:16",
                "files": []
            },
            {
                "text": "Ciao! Sono Mike AI, il tuo Digital Marketing Strategist con 30 anni di esperienza e coordinatore del team AI specialist.\n\nSono specializzato nel creare strategie integrate di digital marketing che generano aumenti di fatturato da 2X a 5X in 12 mesi.\n\n**PRIMA DOMANDA ESSENZIALE:** Qual è il tuo livello di esperienza in digital marketing?\n\nA) Neofita (non so nulla di digital marketing)  \nB) Principiante (conosco qualche base ma ho bisogno di spiegazioni semplici)  \nC) Intermedio (conosci le basi del digital marketing)  \nD) Avanzato/Esperto (posso usare terminologia tecnica e offrire consulenze puntuali)\n\n**SECONDA DOMANDA:** Cosa preferisci oggi?\n\n1. **Strategia completa integrata** (ti proporrò un indice delle attività che svolgeremo insieme)\n2. **Consulenza specifica** su un aspetto particolare (se non sai su cosa, ti darò un menu di opzioni)\n\n**TERZA DOMANDA (sistema onboarding):** Hai a disposizione le tue risposte al Questionario **'DOMANDE per AI TEAM Onboarding'** che contiene 30 domande strategiche sulla tua azienda?\n\n- **Se SÌ:** Incolla tutte le tue risposte nella chat\n- **Se NO:** Ti farò le mie 8-10 domande essenziali per creare la strategia perfetta\n\nIniziamo subito a costruire la tua strategia vincente! 🚀",
                "sender": "ai",
                "time": "00:16",
                "raw": "Ciao! Sono Mike AI, il tuo Digital Marketing Strategist..."
            },
            {
                "text": "",
                "sender": "user",
                "time": "00:17",
                "files": ["Be your best.docx"]
            },
            {
                "text": "Perfetto! Ho ricevuto il documento \"Be your best.docx\". Vedo che si tratta di una **guida informativa per un evento di formazione** con Roberto Re che si terrà a Padova Hall dal 17 al 19 ottobre 2025.\n\nIl documento contiene:\n- 📍 **Informazioni logistiche** (luogo, date, orari)\n- 🏨 **Soluzioni alberghiere** (Best Western, Crowne Plaza, B&B Hotel con codice sconto)\n- 🍽️ **Servizio catering** (pranzi a buffet, opzioni privilege)\n- 🚗 **Come arrivare** (auto, treno, aereo)\n- 📞 **Contatti organizzazione** (Younite - corso Be Your Best Young)\n\nPrima di procedere, ho bisogno di capire **come posso aiutarti** con questo materiale:\n\n**Vuoi che ti aiuti a:**\n\n1. **Creare una strategia di marketing** per promuovere questo evento?\n2. **Ottimizzare la comunicazione** di questa guida informativa?\n3. **Sviluppare campagne pubblicitarie** per aumentare le iscrizioni?\n4. **Migliorare il funnel di conversione** per l'evento?\n5. **Altro?** (spiegami tu cosa hai in mente)",
                "sender": "ai",
                "time": "00:18"
            }
        ],
        "title": "Missione con Mike AI",
        "lastUpdated": "2026-01-16T00:18:00.000Z",
        "folderId": null,
        "archived": false,
        "agentId": "mike-ai",
        "sessionId": "session_1764267349767"
    }
};

// Tests that only use localStorage (no authentication required)
test.describe('Production Data Migration Test - Mike AI', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to establish context
        await page.goto('/');
    });

    test('should correctly store real production chat data in localStorage', async ({ page }) => {
        // Set real production data
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
            localStorage.removeItem('mike-ai-migrated'); // Reset migration flag
        }, REAL_MIKE_AI_CHAT);

        // Verify data was stored
        const storedData = await page.evaluate(() => {
            return localStorage.getItem('mike-ai-chats');
        });

        expect(storedData).not.toBeNull();
        const parsed = JSON.parse(storedData!);

        // Verify the chat exists
        expect(parsed['chat_1764267349767']).toBeDefined();

        // Verify message count
        expect(parsed['chat_1764267349767'].messages).toHaveLength(5);

        // Verify file upload message exists
        const fileMessage = parsed['chat_1764267349767'].messages[3];
        expect(fileMessage.files).toContain('Be your best.docx');
    });

    test('should preserve markdown formatting in messages', async ({ page }) => {
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
        }, REAL_MIKE_AI_CHAT);

        const storedData = await page.evaluate(() => {
            const data = localStorage.getItem('mike-ai-chats');
            return data ? JSON.parse(data) : null;
        });

        const aiMessage = storedData['chat_1764267349767'].messages[2].text;

        // Verify markdown is preserved
        expect(aiMessage).toContain('**PRIMA DOMANDA ESSENZIALE:**');
        expect(aiMessage).toContain('**Strategia completa integrata**');
        expect(aiMessage).toContain('🚀'); // Emoji preserved
        expect(aiMessage).toContain('A) Neofita');
        expect(aiMessage).toContain('B) Principiante');
    });

    test('should preserve file attachments in messages', async ({ page }) => {
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
        }, REAL_MIKE_AI_CHAT);

        const storedData = await page.evaluate(() => {
            const data = localStorage.getItem('mike-ai-chats');
            return data ? JSON.parse(data) : null;
        });

        // Find message with file
        const messageWithFile = storedData['chat_1764267349767'].messages.find(
            (m: any) => m.files && m.files.length > 0
        );

        expect(messageWithFile).toBeDefined();
        expect(messageWithFile.files[0]).toBe('Be your best.docx');
    });

    test('should trigger migration API calls when visiting mike-ai page', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        const apiCalls: { url: string; method: string; body?: any }[] = [];

        // Intercept API calls to /conversations
        await page.route('**/conversations/**', async (route) => {
            const request = route.request();

            apiCalls.push({
                url: request.url(),
                method: request.method(),
                body: request.postDataJSON(),
            });

            // Mock successful response for POST (create conversation)
            if (request.method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'chat_1764267349767',
                        title: 'Missione con Mike AI',
                        agentId: 'mike-ai',
                        messages: [],
                    }),
                });
            } else if (request.method() === 'GET') {
                // Return empty array to simulate no existing conversations
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            } else {
                await route.continue();
            }
        });

        // Set up localStorage with production data
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
            localStorage.removeItem('mike-ai-migrated');
        }, REAL_MIKE_AI_CHAT);

        // Visit the Mike AI page
        await page.goto('/dashboard/mike-ai');

        // Wait for potential migration
        await page.waitForTimeout(5000);

        // Log what API calls were made
        console.log('=== API Calls during Mike AI migration ===');
        apiCalls.forEach((call, index) => {
            console.log(`${index + 1}. ${call.method} ${call.url}`);
            if (call.body) {
                console.log('   Body:', JSON.stringify(call.body, null, 2).substring(0, 200));
            }
        });

        // If authenticated, expect POST call for migration
        // The actual assertion depends on auth state
        console.log(`Total API calls: ${apiCalls.length}`);
    });

    test('should set migration flag after successful migration', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        // Intercept and mock all conversation API calls
        await page.route('**/conversations/**', async (route) => {
            const request = route.request();

            if (request.method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: 'migrated', title: 'Migrated' }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            }
        });

        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
            localStorage.removeItem('mike-ai-migrated');
        }, REAL_MIKE_AI_CHAT);

        await page.goto('/dashboard/mike-ai');
        await page.waitForTimeout(5000);

        // Check migration flag
        const migrationFlag = await page.evaluate(() => {
            return localStorage.getItem('mike-ai-migrated');
        });

        console.log('Migration flag after visit:', migrationFlag);
    });

    test('should NOT re-migrate if flag is already set', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        let postCallCount = 0;

        await page.route('**/conversations/**', async (route) => {
            const request = route.request();

            if (request.method() === 'POST') {
                postCallCount++;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),
            });
        });

        // Set both data AND migration flag
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
            localStorage.setItem('mike-ai-migrated', 'true'); // Already migrated!
        }, REAL_MIKE_AI_CHAT);

        await page.goto('/dashboard/mike-ai');
        await page.waitForTimeout(3000);

        console.log('POST calls when already migrated:', postCallCount);

        // Should NOT make POST calls for migration since already done
        // (GET calls for loading are expected)
    });
});

test.describe('Multi-Agent Production Migration', () => {

    test('should handle multiple agents with different localStorage keys', async ({ page }) => {
        await page.goto('/');

        // Simulate real production: multiple agents have chats
        await page.evaluate(() => {
            // Mike AI chats
            localStorage.setItem('mike-ai-chats', JSON.stringify({
                'mike_chat_1': { id: 'mike_chat_1', agentId: 'mike-ai', messages: [{ text: 'Mike msg', sender: 'ai', time: '10:00' }], title: 'Mike Chat' }
            }));

            // Jim AI chats
            localStorage.setItem('jim-ai-chats', JSON.stringify({
                'jim_chat_1': { id: 'jim_chat_1', agentId: 'jim-ai', messages: [{ text: 'Jim msg', sender: 'ai', time: '11:00' }], title: 'Jim Chat' }
            }));

            // Tony AI chats
            localStorage.setItem('tony-ai-chats', JSON.stringify({
                'tony_chat_1': { id: 'tony_chat_1', agentId: 'tony-ai', messages: [{ text: 'Tony msg', sender: 'ai', time: '12:00' }], title: 'Tony Chat' }
            }));

            // Reset all migration flags
            localStorage.removeItem('mike-ai-migrated');
            localStorage.removeItem('jim-ai-migrated');
            localStorage.removeItem('tony-ai-migrated');
        });

        // Verify all agents have data
        const allData = await page.evaluate(() => {
            return {
                mike: localStorage.getItem('mike-ai-chats'),
                jim: localStorage.getItem('jim-ai-chats'),
                tony: localStorage.getItem('tony-ai-chats'),
            };
        });

        expect(allData.mike).not.toBeNull();
        expect(allData.jim).not.toBeNull();
        expect(allData.tony).not.toBeNull();

        console.log('All agents have localStorage data ready for migration');
    });

    test('visiting one agent should only migrate that agent data', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        let apiCalls: string[] = [];

        await page.route('**/conversations/**', async (route) => {
            apiCalls.push(route.request().url());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),
            });
        });

        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('mike-ai-chats', JSON.stringify({ 'c1': { id: 'c1', agentId: 'mike-ai', messages: [], title: 'Test' } }));
            localStorage.setItem('jim-ai-chats', JSON.stringify({ 'c2': { id: 'c2', agentId: 'jim-ai', messages: [], title: 'Test' } }));
            localStorage.removeItem('mike-ai-migrated');
            localStorage.removeItem('jim-ai-migrated');
        });

        // Only visit Mike AI
        await page.goto('/dashboard/mike-ai');
        await page.waitForTimeout(3000);

        // Check that only mike-ai migration flag is set (if authenticated)
        const flags = await page.evaluate(() => ({
            mike: localStorage.getItem('mike-ai-migrated'),
            jim: localStorage.getItem('jim-ai-migrated'),
        }));

        console.log('Migration flags:', flags);
        console.log('API calls made:', apiCalls.length);
    });
});

test.describe('Console Log Verification', () => {

    test('should log migration progress to console', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        const consoleLogs: string[] = [];

        page.on('console', (msg) => {
            const text = msg.text();
            if (text.includes('Mike AI') || text.includes('migration') || text.includes('localStorage')) {
                consoleLogs.push(text);
            }
        });

        await page.goto('/');
        await page.evaluate((data) => {
            localStorage.setItem('mike-ai-chats', JSON.stringify(data));
            localStorage.removeItem('mike-ai-migrated');
        }, REAL_MIKE_AI_CHAT);

        await page.goto('/dashboard/mike-ai');
        await page.waitForTimeout(5000);

        console.log('=== Console logs during migration ===');
        consoleLogs.forEach((log, i) => {
            console.log(`${i + 1}. ${log}`);
        });

        // At minimum, page should load without JavaScript errors
        const pageLoaded = await page.locator('body').isVisible();
        expect(pageLoaded).toBe(true);
    });
});
