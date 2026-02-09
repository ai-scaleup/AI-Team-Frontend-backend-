import 'dotenv/config';
// Using Node.js 18+ native fetch

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api'; // Adjust default if needed
const USER_ID = process.argv[2];

if (!USER_ID) {
    console.error('❌ Please provide a User ID (oauthId) as an argument.');
    console.error('Usage: npx tsx scripts/verify-system.ts <USER_ID>');
    process.exit(1);
}

console.log(`🔍 Starting Verification for User ID: ${USER_ID}`);
console.log(`🌐 API Base: ${API_BASE}`);

async function verifyPreferences() {
    console.log('\n--- 1. Verifying User Preferences ---');
    const agentName = 'JIM';
    const url = `${API_BASE}/user-preferences/${encodeURIComponent(USER_ID)}/${encodeURIComponent(agentName)}/or-create`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const data = await res.json();
        console.log('✅ Preferences fetched successfully.');

        if (data.oauthId === USER_ID) {
            console.log('✅ oauthId matches provided User ID.');
        } else {
            console.error(`❌ Mismatch: Prefs oauthId (${data.oauthId}) != provided ID (${USER_ID})`);
        }
    } catch (error) {
        console.error('❌ Failed to verify preferences:', error);
    }
}

async function verifyConversations() {
    console.log('\n--- 2. Verifying Conversation Persistence ---');
    const agentId = 'jim-ai';
    const testTitle = `Test Chat ${Date.now()}`;

    // 1. Create Conversation
    console.log('🔹 Creating test conversation...');
    const createUrl = `${API_BASE}/conversations/${encodeURIComponent(USER_ID)}`;
    let chatId = '';

    try {
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `test_algo_${Date.now()}`,
                title: testTitle,
                agentId: agentId,
                messages: [{ text: 'Hello, system check.', sender: 'user', time: new Date().toISOString() }]
            })
        });

        if (!createRes.ok) throw new Error(`Create Failed: ${createRes.statusText}`);
        const chatData = await createRes.json();
        chatId = chatData.id;
        console.log(`✅ Conversation created: ${chatId}`);

        // 2. Fetch Conversations
        console.log('🔹 Fetching conversations list...');
        const listUrl = `${API_BASE}/conversations/${encodeURIComponent(USER_ID)}?agentId=${agentId}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();

        const found = listData.find((c: any) => c.id === chatId);
        if (found) {
            console.log('✅ Newly created conversation found in list.');
        } else {
            console.error('❌ Created conversation NOT found in list.');
        }

    } catch (error) {
        console.error('❌ Conversation verification failed:', error);
    }
}

async function run() {
    await verifyPreferences();
    await verifyConversations();
    console.log('\n🏁 Verification Complete.');
}

run();
