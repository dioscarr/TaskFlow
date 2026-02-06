import { chatWithAI } from '@/app/actions';

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const {
        query,
        fileIds,
        history,
        currentFolder,
        currentFolderId,
        sessionId,
        verbosity,
        activeAppName,
        activeAppPath
    } = body || {};

    // Validate payload size to prevent ECONNRESET
    const fileCount = Array.isArray(fileIds) ? fileIds.length : 0;
    const historyCount = Array.isArray(history) ? history.length : 0;

    if (fileCount > 50) {
        console.warn(`⚠️ Large file context: ${fileCount} files`);
    }

    if (historyCount > 100) {
        console.warn(`⚠️ Large history: ${historyCount} messages`);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Get Gemini with streaming enabled
                const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
                if (!apiKey) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'API Key missing' })}\n\n`)
                    );
                    controller.close();
                    return;
                }

                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                // Start streaming response from Gemini
                const result = await model.generateContentStream(query);
                
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: chunkText })}\n\n`)
                        );
                    }
                }

                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: 'done' })}\n\n`
                    )
                );
                controller.close();
            } catch (error) {
                console.error('Stream error:', error);
                try {
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({
                                type: 'error',
                                message: error instanceof Error ? error.message : 'Streaming failed'
                            })}\n\n`
                        )
                    );
                } catch (enqueueError) {
                    console.error('Failed to enqueue error:', enqueueError);
                }
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable nginx buffering if behind proxy
        }
    });
}
