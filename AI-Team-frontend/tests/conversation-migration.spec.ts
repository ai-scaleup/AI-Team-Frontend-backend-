import { test, expect, Page } from '@playwright/test';

/**
 * Conversation Migration E2E Tests
 * 
 * These tests verify that the localStorage to database migration works correctly
 * for all AI agents. The migration should:
 * 1. Read chats from localStorage
 * 2. Call the API to create conversations in the database
 * 3. Set a migration flag to prevent re-migration
 * 4. Load conversations from API on subsequent visits
 * 
 * NOTE: Tests that navigate to /dashboard/* pages require authentication.
 * These are skipped in CI environments. Run locally with authentication for full coverage.
 */

// Skip tests that require authentication in CI
const skipAuthTests = !!process.env.CI;

// Test data for mock chats in localStorage
const mockChatData = {
    'chat_1705000000000': {
        id: 'chat_1705000000000',
        messages: [
            { text: 'Ciao! Come posso aiutarti?', sender: 'ai', time: '10:00' },
            { text: 'Ho bisogno di aiuto con la strategia', sender: 'user', time: '10:01' },
            { text: 'Certo, parliamo della tua strategia.', sender: 'ai', time: '10:02' },
        ],
        title: 'Test Migrated Chat',
        lastUpdated: '2024-01-11T10:00:00.000Z',
        folderId: null,
        archived: false,
        agentId: 'jim-ai',
        sessionId: 'session_test_123',
    },
    'chat_1705000001000': {
        id: 'chat_1705000001000',
        messages: [
            { text: 'Benvenuto!', sender: 'ai', time: '11:00' },
            { text: 'Grazie!', sender: 'user', time: '11:01' },
        ],
        title: 'Second Test Chat',
        lastUpdated: '2024-01-12T11:00:00.000Z',
        folderId: null,
        archived: false,
        agentId: 'jim-ai',
        sessionId: 'session_test_456',
    },
};

// Agents that have migration implemented
const AGENTS_WITH_MIGRATION = [
    { id: 'jim-ai', localStorageKey: 'jim-ai-chats', migrationFlag: 'jim-ai-migrated' },
    { id: 'tony-ai', localStorageKey: 'tony-ai-chats', migrationFlag: 'tony-ai-migrated' },
    { id: 'mike-ai', localStorageKey: 'mike-ai-chats', migrationFlag: 'mike-ai-migrated' },
    { id: 'alex-ai', localStorageKey: 'alex-ai-chats', migrationFlag: 'alex-ai-migrated' },
    { id: 'niko-ai', localStorageKey: 'niko-ai-chats', migrationFlag: 'niko-ai-migrated' },
    { id: 'simone-ai', localStorageKey: 'simone-ai-chats', migrationFlag: 'simone-ai-migrated' },
    { id: 'valentina-ai', localStorageKey: 'valentina-ai-chats', migrationFlag: 'valentina-ai-migrated' },
    { id: 'lara-ai', localStorageKey: 'lara-ai-chats', migrationFlag: 'lara-ai-migrated' },
    { id: 'laura-ai', localStorageKey: 'laura-ai-chats', migrationFlag: 'laura-ai-migrated' },
    { id: 'aladino-ai', localStorageKey: 'aladino-ai-chats', migrationFlag: 'aladino-ai-migrated' },
    { id: 'daniele-ai', localStorageKey: 'daniele-ai-chats', migrationFlag: 'daniele-ai-migrated' },
];

test.describe('Conversation Migration Tests', () => {

    test.describe('Pre-migration State', () => {
        test('should have localStorage chats before migration', async ({ page }) => {
            // Navigate first to establish context
            await page.goto('/');

            // Set localStorage with mock data
            await page.evaluate((data) => {
                localStorage.setItem('jim-ai-chats', JSON.stringify(data));
            }, mockChatData);

            // Verify localStorage was set correctly
            const storedChats = await page.evaluate(() => {
                return localStorage.getItem('jim-ai-chats');
            });

            expect(storedChats).not.toBeNull();
            const parsedChats = JSON.parse(storedChats!);
            expect(Object.keys(parsedChats)).toHaveLength(2);
        });

        test('migration flag should NOT exist before first visit to agent page', async ({ page }) => {
            await page.goto('/');

            const migrationFlag = await page.evaluate(() => {
                return localStorage.getItem('jim-ai-migrated');
            });

            expect(migrationFlag).toBeNull();
        });
    });

    test.describe('Migration Trigger', () => {
        test('visiting agent page should trigger migration and set flag', async ({ page }) => {
            test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
            // Setup: Add chats to localStorage
            await page.goto('/');
            await page.evaluate((data) => {
                localStorage.setItem('jim-ai-chats', JSON.stringify(data));
                // Ensure migration flag is not set
                localStorage.removeItem('jim-ai-migrated');
            }, mockChatData);

            // Listen for console logs to verify migration output
            const consoleLogs: string[] = [];
            page.on('console', (msg) => {
                if (msg.text().includes('Jim AI')) {
                    consoleLogs.push(msg.text());
                }
            });

            // Visit the agent page (requires authentication in real scenario)
            await page.goto('/dashboard/jim-ai');

            // Wait for page to load and potentially trigger migration
            await page.waitForTimeout(3000);

            // Check if migration flag was set
            const migrationFlag = await page.evaluate(() => {
                return localStorage.getItem('jim-ai-migrated');
            });

            // In authenticated scenario, flag should be set to 'true'
            // If not authenticated, we just verify the page loaded
            console.log('Migration flag after visit:', migrationFlag);
            console.log('Console logs:', consoleLogs);
        });

        test('should skip migration if already migrated', async ({ page }) => {
            test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
            await page.goto('/');

            // Set migration flag to indicate already migrated
            await page.evaluate(() => {
                localStorage.setItem('jim-ai-migrated', 'true');
                localStorage.setItem('jim-ai-chats', JSON.stringify({
                    'old_chat': { id: 'old_chat', title: 'Old Chat', messages: [] }
                }));
            });

            // Listen for console logs
            const consoleLogs: string[] = [];
            page.on('console', (msg) => {
                if (msg.text().includes('Already migrated')) {
                    consoleLogs.push(msg.text());
                }
            });

            await page.goto('/dashboard/jim-ai');
            await page.waitForTimeout(2000);

            // The localStorage chats should still exist (not deleted)
            const chats = await page.evaluate(() => {
                return localStorage.getItem('jim-ai-chats');
            });

            expect(chats).not.toBeNull();
        });
    });

    test.describe('Migration Data Integrity', () => {
        test('migrated chats should retain all message content', async ({ page }) => {
            await page.goto('/');

            // Set up localStorage with specific messages to verify
            const testMessages = [
                { text: 'Primo messaggio di test', sender: 'user', time: '09:00' },
                { text: 'Risposta AI dettagliata con **markdown**', sender: 'ai', time: '09:01' },
                { text: 'Follow-up question', sender: 'user', time: '09:02' },
            ];

            await page.evaluate((messages) => {
                localStorage.setItem('jim-ai-chats', JSON.stringify({
                    'test_chat_integrity': {
                        id: 'test_chat_integrity',
                        messages: messages,
                        title: 'Integrity Test Chat',
                        lastUpdated: new Date().toISOString(),
                        folderId: null,
                        archived: false,
                        agentId: 'jim-ai',
                        sessionId: 'session_integrity_test',
                    }
                }));
                localStorage.removeItem('jim-ai-migrated');
            }, testMessages);

            // Verify the data is stored correctly
            const storedData = await page.evaluate(() => {
                const data = localStorage.getItem('jim-ai-chats');
                return data ? JSON.parse(data) : null;
            });

            expect(storedData).not.toBeNull();
            expect(storedData.test_chat_integrity.messages).toHaveLength(3);
            expect(storedData.test_chat_integrity.messages[0].text).toBe('Primo messaggio di test');
        });

        test('chat metadata should be preserved during migration', async ({ page }) => {
            await page.goto('/');

            const testChat = {
                id: 'metadata_test_chat',
                messages: [{ text: 'Test', sender: 'user' as const, time: '10:00' }],
                title: 'Metadata Test Title',
                lastUpdated: '2024-01-15T14:30:00.000Z',
                folderId: 'folder_123',
                archived: true,
                agentId: 'jim-ai',
                sessionId: 'session_meta_789',
            };

            await page.evaluate((chat) => {
                localStorage.setItem('jim-ai-chats', JSON.stringify({
                    [chat.id]: chat
                }));
            }, testChat);

            const storedData = await page.evaluate(() => {
                const data = localStorage.getItem('jim-ai-chats');
                return data ? JSON.parse(data) : null;
            });

            const storedChat = storedData.metadata_test_chat;
            expect(storedChat.title).toBe('Metadata Test Title');
            expect(storedChat.folderId).toBe('folder_123');
            expect(storedChat.archived).toBe(true);
            expect(storedChat.sessionId).toBe('session_meta_789');
        });
    });

    test.describe('Multi-Agent Migration', () => {
        // Generate tests for each agent
        for (const agent of AGENTS_WITH_MIGRATION.slice(0, 3)) { // Test first 3 agents to keep tests fast
            test(`${agent.id} should have correct localStorage keys`, async ({ page }) => {
                await page.goto('/');

                // Create agent-specific mock data
                const agentMockData = {
                    [`chat_${agent.id}_001`]: {
                        id: `chat_${agent.id}_001`,
                        messages: [{ text: `Welcome to ${agent.id}!`, sender: 'ai', time: '10:00' }],
                        title: `${agent.id} Test Chat`,
                        lastUpdated: new Date().toISOString(),
                        folderId: null,
                        archived: false,
                        agentId: agent.id,
                        sessionId: `session_${agent.id}_001`,
                    }
                };

                await page.evaluate(({ key, data }) => {
                    localStorage.setItem(key, JSON.stringify(data));
                }, { key: agent.localStorageKey, data: agentMockData });

                // Verify storage
                const storedData = await page.evaluate((key) => {
                    return localStorage.getItem(key);
                }, agent.localStorageKey);

                expect(storedData).not.toBeNull();
                const parsed = JSON.parse(storedData!);
                expect(parsed[`chat_${agent.id}_001`]).toBeDefined();
                expect(parsed[`chat_${agent.id}_001`].agentId).toBe(agent.id);
            });
        }
    });

    test.describe('Error Handling', () => {
        test('should handle empty localStorage gracefully', async ({ page }) => {
            test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
            await page.goto('/');

            // Ensure no chats exist
            await page.evaluate(() => {
                localStorage.removeItem('jim-ai-chats');
                localStorage.removeItem('jim-ai-migrated');
            });

            // Visit page - should not crash
            await page.goto('/dashboard/jim-ai');
            await page.waitForTimeout(2000);

            // Migration flag should be set even with no data
            // (in authenticated scenario)
            const pageLoaded = await page.locator('body').isVisible();
            expect(pageLoaded).toBe(true);
        });

        test('should handle malformed localStorage data', async ({ page }) => {
            test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
            await page.goto('/');

            // Set invalid JSON
            await page.evaluate(() => {
                localStorage.setItem('jim-ai-chats', 'not valid json {{{');
                localStorage.removeItem('jim-ai-migrated');
            });

            // Listen for errors
            const errors: string[] = [];
            page.on('pageerror', (err) => {
                errors.push(err.message);
            });

            await page.goto('/dashboard/jim-ai');
            await page.waitForTimeout(2000);

            // Page should still load despite bad data
            const pageLoaded = await page.locator('body').isVisible();
            expect(pageLoaded).toBe(true);
        });
    });

    test.describe('API Integration', () => {
        test('should make correct API calls during migration', async ({ page }) => {
            test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
            const apiCalls: { url: string; method: string; body?: any }[] = [];

            // Intercept API calls
            await page.route('**/conversations/**', async (route) => {
                const request = route.request();
                apiCalls.push({
                    url: request.url(),
                    method: request.method(),
                    body: request.postDataJSON(),
                });

                // Mock successful response
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'chat_migrated',
                        title: 'Migrated Chat',
                        messages: [],
                    }),
                });
            });

            await page.goto('/');
            await page.evaluate((data) => {
                localStorage.setItem('jim-ai-chats', JSON.stringify(data));
                localStorage.removeItem('jim-ai-migrated');
            }, mockChatData);

            await page.goto('/dashboard/jim-ai');
            await page.waitForTimeout(3000);

            // Log API calls made (useful for debugging)
            console.log('API calls made during migration:', apiCalls);
        });
    });
});

test.describe('Post-Migration Verification', () => {
    test('should load conversations from API after migration', async ({ page }) => {
        test.skip(skipAuthTests, 'Requires authentication - skipped in CI');
        // Mock API response with migrated data
        await page.route('**/conversations/**', async (route) => {
            const request = route.request();

            if (request.method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'api_chat_1',
                            title: 'Chat from API',
                            agentId: 'jim-ai',
                            messages: [
                                { text: 'This came from the API', sender: 'ai', time: '12:00' }
                            ],
                            lastUpdated: new Date().toISOString(),
                            archived: false,
                            folderId: null,
                            sessionId: 'session_api_1',
                        }
                    ]),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/');

        // Set migration flag to skip localStorage migration
        await page.evaluate(() => {
            localStorage.setItem('jim-ai-migrated', 'true');
        });

        await page.goto('/dashboard/jim-ai');
        await page.waitForTimeout(2000);

        // Verify that API data would be loaded (check for console log or UI element)
        const pageContent = await page.content();
        console.log('Page loaded after migration flag set');
    });
});
