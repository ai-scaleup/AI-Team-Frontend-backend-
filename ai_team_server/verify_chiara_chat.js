
const http = require('http');

const postData = JSON.stringify({
    sessionId: 'test-chat-session-' + Date.now(),
    sender: 'user',
    messageText: 'Hello Chiara!'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/chiara/chat-logs',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    }
};

const req = http.request(options, (res) => {
    console.log(`CHAT LOG STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`CHAT LOG BODY: ${chunk}`);

        try {
            const body = JSON.parse(chunk);
            if (body.sessionId) {
                // Verify GET
                const getOptions = {
                    hostname: 'localhost',
                    port: 3000,
                    path: `/chiara/chat-logs/${body.sessionId}`,
                    method: 'GET'
                };

                const getReq = http.request(getOptions, (getRes) => {
                    console.log(`GET CHAT LOG STATUS: ${getRes.statusCode}`);
                    getRes.setEncoding('utf8');
                    getRes.on('data', (getChunk) => {
                        console.log(`GET CHAT LOG BODY: ${getChunk}`);
                    });
                });
                getReq.end();
            }
        } catch (e) {
            console.error(e);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
