/**
 * Simple API Test - Raw Output V2
 * Tests both XML and markdown thinking formats
 */

const http = require('http');

const testQuery = "Explain what your purpose is as an AI agent.";

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
    let rawData = '';

    res.on('data', (chunk) => {
        rawData += chunk.toString();
    });

    res.on('end', () => {
        console.log('\n=== RAW SSE DATA ===\n');
        console.log(rawData);

        // Parse and extract full text
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
            } catch (e) { }
        }

        console.log('\n=== RECONSTRUCTED TEXT ===\n');
        console.log(fullText);

        console.log('\n=== DONE PAYLOAD ===');
        console.log(JSON.stringify(metadata, null, 2));

        console.log('\n=== THINKING CHECK ===');

        // Check for both formats
        const hasXmlOpening = fullText.includes('<thinking>');
        const hasXmlClosing = fullText.includes('</thinking>');
        const hasMdOpening = fullText.includes('```thinking');
        const hasMdClosing = fullText.includes('```') && hasMdOpening;

        console.log('Has XML <thinking>:', hasXmlOpening);
        console.log('Has XML </thinking>:', hasXmlClosing);
        console.log('Has Markdown ```thinking:', hasMdOpening);
        console.log('Has Markdown closing:', hasMdClosing);

        // Check metadata for thinking
        console.log('Has Meta Thinking:', !!metadata.thinking);
        if (metadata.thinking) {
            console.log('\n=== EXTRACTED THINKING (from metadata) ===');
            console.log(metadata.thinking);
        }

        // Extract inline thinking
        const xmlMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
        const mdMatch = fullText.match(/```thinking\n?([\s\S]*?)```/);

        if (xmlMatch) {
            console.log('\n=== XML THINKING CONTENT ===');
            console.log(xmlMatch[1]);
        }

        if (mdMatch) {
            console.log('\n=== MARKDOWN THINKING CONTENT ===');
            console.log(mdMatch[1]);
        }

        // Summary
        console.log('\n=== SUMMARY ===');
        if (metadata.thinking || xmlMatch || mdMatch) {
            console.log('✅ SUCCESS: Thinking was captured!');
        } else if (hasMdOpening || hasXmlOpening) {
            console.log('⚠️ PARTIAL: Thinking tags present in response but not extracted to metadata');
        } else {
            console.log('❌ FAILED: No thinking detected');
        }
    });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();
