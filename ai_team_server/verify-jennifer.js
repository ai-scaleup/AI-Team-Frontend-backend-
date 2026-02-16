
const http = require('http');

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path: path,
            agent: false
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data: data });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function verify() {
    console.log('Verifying Jennifer Module...');

    try {
        // 1. Get Sessions
        console.log('Testing GET /jennifer/sessions');
        const sessionsRes = await makeRequest('/jennifer/sessions');
        console.log(`Status: ${sessionsRes.statusCode}`);
        if (sessionsRes.statusCode !== 200) {
            console.error('Failed to get sessions');
            console.log(sessionsRes.data);
            return;
        }
        const sessions = JSON.parse(sessionsRes.data);
        console.log(`Found ${sessions.length} sessions`);

        if (sessions.length > 0) {
            const sessionId = sessions[0];
            console.log(`Testing GET /jennifer/chat-logs/${sessionId}`);
            const chatLogsRes = await makeRequest(`/jennifer/chat-logs/${sessionId}`);
            console.log(`Status: ${chatLogsRes.statusCode}`);
            if (chatLogsRes.statusCode === 200) {
                const logs = JSON.parse(chatLogsRes.data);
                console.log(`Found ${logs.length} chat logs for session ${sessionId}`);
                if (logs.length > 0) {
                    console.log('Sample log:', JSON.stringify(logs[0], null, 2));
                    if (!logs[0].sender || !logs[0].messageText) {
                        console.warn('WARNING: Log structure might be incorrect (expected sender, messageText)');
                    }
                }
                console.log('Verification Successful!');
            } else {
                console.error('Failed to get chat logs');
                console.log(chatLogsRes.data);
            }
        } else {
            console.log('No sessions found to test chat logs.');
        }

    } catch (err) {
        console.error('Verification failed:', err.message);
        console.log('Is the server running on port 3000?');
    }
}

verify();
