
const http = require('http');

const postData = JSON.stringify({
    sessionId: 'test-session-' + Date.now(),
    name: 'Test Lead',
    email: 'test' + Date.now() + '@example.com',
    phone: '1234567890'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/chiara/leads',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);

        // Parse body to get sessionId
        try {
            const body = JSON.parse(chunk);
            if (body.sessionId) {
                // Verify GET
                const getOptions = {
                    hostname: 'localhost',
                    port: 3000,
                    path: `/chiara/leads/${body.sessionId}`,
                    method: 'GET'
                };

                const getReq = http.request(getOptions, (getRes) => {
                    console.log(`GET STATUS: ${getRes.statusCode}`);
                    getRes.setEncoding('utf8');
                    getRes.on('data', (getChunk) => {
                        console.log(`GET BODY: ${getChunk}`);
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
