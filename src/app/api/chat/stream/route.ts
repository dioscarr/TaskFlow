import { chatWithAI } from '@/app/actions';

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return new Response('Invalid JSON body', { status: 400 });
    }
    const {
        query,
        fileIds,
        history,
        currentFolder,
        currentFolderId,
        sessionId
    } = body || {};

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const res = await chatWithAI(
                    query,
                    Array.isArray(fileIds) ? fileIds : [],
                    Array.isArray(history) ? history : [],
                    currentFolder,
                    currentFolderId,
                    { sessionId, allowToolExecution: false }
                );

                if (!res?.success) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'error', message: res?.message || 'AI failed' })}\n\n`)
                    );
                    controller.close();
                    return;
                }

                const text = (res.text || '').toString();
                const chunkSize = 16;

                for (let i = 0; i < text.length; i += chunkSize) {
                    const chunk = text.slice(i, i + chunkSize);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`)
                    );
                }

                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({
                            type: 'done',
                            toolUsed: res.toolUsed,
                            toolResult: res.toolResult,
                            thinking: res.thinking,
                            toolArgs: res.toolArgs
                        })}\n\n`
                    )
                );

                controller.close();
            } catch (error) {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({
                            type: 'error',
                            message: error instanceof Error ? error.message : 'Streaming failed'
                        })}\n\n`
                    )
                );
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive'
        }
    });
}
