/**
 * Complex Task Test
 * Verifies that orchestration still works for deep work
 */

const http = require('http');

const testQuery = "Create a new landing page for a coffee shop with glassmorphic design.";

const postData = JSON.stringify({
    query: testQuery,
    fileIds: [],
    history: [],
    currentFolder: 'Root',
    currentFolderId: null,
    sessionId: 'test-session-' + Date.now()
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/chat/stream',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => rawData += chunk.toString());
    res.on('end', () => {
        console.log('\n=== RESPONSE ===\n');

        let fullText = '';
        let metadata = {};
        const events = rawData.split('\n\n').filter(e => e.trim());
        for (const event of events) {
            const dataLine = event.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
                const payload = JSON.parse(dataLine.replace('data: ', ''));
                if (payload.type === 'delta') fullText += payload.text;
                if (payload.type === 'done') metadata = payload;
            } catch (e) { }
        }

        console.log('Text Output:', fullText);
        console.log('\nMetadata:', JSON.stringify(metadata, null, 2));

        if (metadata.toolUsed === 'enqueue_agent_job') {
            console.log('\n✅ SUCCESS: Orchestration triggered correctly for complex task.');
        } else {
            console.log('\n❌ FAILED: Orchestration should have been triggered but was not.');
        }
    });
});

req.write(postData);
req.end();
