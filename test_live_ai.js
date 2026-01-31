/**
 * Live AI API Test - Full Response Capture
 * 
 * This script makes a real API call and captures the COMPLETE response
 * before analyzing it.
 */

const http = require('http');

const testQuery = "Hello! Respond with a greeting. Remember to start with your thinking block.";

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    LIVE AI API TEST                              ║
╚══════════════════════════════════════════════════════════════════╝

📤 Sending test query to AI...
`);
console.log(`Query: "${testQuery}"`);
console.log(`
═══════════════════════════════════════════════════════════════════
`);

const postData = JSON.stringify({
    query: testQuery,
    fileIds: [],
    history: [],
    currentFolder: 'Root',
    currentFolderId: null,
    sessionId: null
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
    console.log(`Status: ${res.statusCode}`);

    let rawChunks = [];

    res.on('data', (chunk) => {
        rawChunks.push(chunk.toString());
    });

    res.on('end', () => {
        console.log(`
───────────────────────────────────────────────────────────────────
RAW RESPONSE:
───────────────────────────────────────────────────────────────────
`);

        // Reconstruct full response from chunks
        const rawData = rawChunks.join('');

        // Parse SSE events
        let fullText = '';
        let metadata = {};

        const events = rawData.split('\n\n').filter(e => e.trim());
        for (const event of events) {
            const dataLine = event.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;

            try {
                const payload = JSON.parse(dataLine.replace('data: ', ''));
                if (payload.type === 'delta') {
                    fullText += payload.text;
                }
                if (payload.type === 'done') {
                    metadata = payload;
                }
            } catch (e) {
                // Skip malformed JSON
            }
        }

        console.log('Full Text Response:');
        console.log('─'.repeat(60));
        console.log(fullText);
        console.log('─'.repeat(60));

        console.log(`
═══════════════════════════════════════════════════════════════════
ANALYSIS
═══════════════════════════════════════════════════════════════════
`);

        // Check for thinking in response
        const thinkingMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
        const hasInlineThinking = !!thinkingMatch;
        const hasMetaThinking = !!metadata.thinking;

        console.log(`Response Length: ${fullText.length} characters`);
        console.log(`Has Inline <thinking>: ${hasInlineThinking ? '✅ YES' : '❌ NO'}`);
        console.log(`Has Meta Thinking: ${hasMetaThinking ? '✅ YES' : '❌ NO'}`);
        console.log(`Tool Used: ${metadata.toolUsed || 'None'}`);

        if (hasInlineThinking) {
            console.log(`
───────────────────────────────────────────────────────────────────
THINKING CONTENT:
───────────────────────────────────────────────────────────────────
${thinkingMatch[1]}
───────────────────────────────────────────────────────────────────
`);
        }

        if (hasMetaThinking) {
            console.log(`
───────────────────────────────────────────────────────────────────
META THINKING:
───────────────────────────────────────────────────────────────────
${metadata.thinking}
───────────────────────────────────────────────────────────────────
`);
        }

        if (hasInlineThinking || hasMetaThinking) {
            console.log(`
✅  SUCCESS! AI is now including thinking in responses!
`);
        } else {
            console.log(`
⚠️  AI did NOT include thinking.
`);
        }
    });
});

req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
