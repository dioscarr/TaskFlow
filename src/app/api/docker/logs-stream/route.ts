import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

/**
 * Live Docker Container Logs Streaming API
 *
 * Uses Server-Sent Events (SSE) to stream container logs in real-time
 * Compatible with EventSource on the client side
 *
 * Usage:
 *   const eventSource = new EventSource('/api/docker/logs-stream?container=my-app-dev');
 *   eventSource.onmessage = (event) => {
 *     const { log, timestamp, level } = JSON.parse(event.data);
 *     console.log(log);
 *   };
 */
export async function GET(request: NextRequest) {
    const containerName = request.nextUrl.searchParams.get('container');
    const tail = request.nextUrl.searchParams.get('tail') || '100'; // Default last 100 lines

    if (!containerName) {
        return new Response('Missing container parameter', { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const safeClose = () => {
                if (!isClosed) {
                    try {
                        controller.close();
                        isClosed = true;
                    } catch (err) {
                        // Controller already closed
                    }
                }
            };

            const safeEnqueue = (data: Uint8Array) => {
                if (!isClosed) {
                    try {
                        controller.enqueue(data);
                    } catch (err) {
                        // Stream might be closed
                        isClosed = true;
                    }
                }
            };

            // Send initial ready message
            safeEnqueue(encoder.encode(
                `data: ${JSON.stringify({
                    type: 'connected',
                    container: containerName,
                    timestamp: new Date().toISOString()
                })}\n\n`
            ));

            const logsProcess = spawn('docker', [
                'logs',
                '--follow',
                '--timestamps',
                '--tail', tail,
                containerName
            ]);

            // Handle stdout (normal logs)
            logsProcess.stdout.on('data', (data: Buffer) => {
                const text = data.toString();
                const lines = text.split('\n').filter(Boolean);

                lines.forEach(line => {
                    // Parse timestamp from Docker logs format: "2024-02-08T10:30:00.123Z message"
                    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);
                    const timestamp = match ? match[1] : new Date().toISOString();
                    const log = match ? match[2] : line;

                    safeEnqueue(encoder.encode(
                        `data: ${JSON.stringify({
                            log,
                            timestamp,
                            level: 'info',
                            container: containerName
                        })}\n\n`
                    ));
                });
            });

            // Handle stderr (error logs)
            logsProcess.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                const lines = text.split('\n').filter(Boolean);

                lines.forEach(line => {
                    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);
                    const timestamp = match ? match[1] : new Date().toISOString();
                    const log = match ? match[2] : line;

                    safeEnqueue(encoder.encode(
                        `data: ${JSON.stringify({
                            log,
                            timestamp,
                            level: 'error',
                            container: containerName
                        })}\n\n`
                    ));
                });
            });

            // Handle process errors (container not found, Docker not running, etc.)
            logsProcess.on('error', (error) => {
                safeEnqueue(encoder.encode(
                    `data: ${JSON.stringify({
                        type: 'error',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    })}\n\n`
                ));
                safeClose();
            });

            // Handle process exit
            logsProcess.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    safeEnqueue(encoder.encode(
                        `data: ${JSON.stringify({
                            type: 'error',
                            error: `Log stream closed with code ${code}`,
                            timestamp: new Date().toISOString()
                        })}\n\n`
                    ));
                }
                safeClose();
            });

            // Handle client disconnect
            request.signal.addEventListener('abort', () => {
                logsProcess.kill();
                safeClose();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering
        }
    });
}
