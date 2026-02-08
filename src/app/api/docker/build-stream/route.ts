import { spawn } from 'child_process';
import { NextRequest } from 'next/server';

/**
 * Streaming Docker Build API
 *
 * Streams real-time build progress as Server-Sent Events (SSE)
 *
 * Usage:
 * const eventSource = new EventSource('/api/docker/build-stream?app=salon-premium');
 * eventSource.onmessage = (event) => {
 *   const { stage, message, progress } = JSON.parse(event.data);
 * };
 */

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const appName = searchParams.get('app');
    const dockerfilePath = searchParams.get('dockerfile');
    const context = searchParams.get('context');
    const imageName = searchParams.get('image');

    if (!appName || !dockerfilePath || !context || !imageName) {
        return new Response('Missing required parameters', { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            try {
                sendEvent({
                    stage: 'preparing',
                    message: 'Preparing Docker build...',
                    progress: 0,
                    timestamp: new Date().toISOString()
                });

                // Spawn docker build process
                const buildProcess = spawn('docker', [
                    'build',
                    '-t', imageName,
                    '-f', dockerfilePath,
                    context
                ], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });

                let currentStage = 'building';
                let currentStep = 0;
                let totalSteps = 8; // Estimated from Dockerfile

                // Parse stdout for build progress
                buildProcess.stdout.on('data', (data: Buffer) => {
                    const output = data.toString();
                    const lines = output.split('\n').filter(Boolean);

                    lines.forEach(line => {
                        // Detect build stages
                        if (line.includes('Step ')) {
                            const match = line.match(/Step (\d+)\/(\d+)/);
                            if (match) {
                                currentStep = parseInt(match[1]);
                                totalSteps = parseInt(match[2]);
                                const progress = Math.round((currentStep / totalSteps) * 100);

                                sendEvent({
                                    stage: 'building',
                                    message: line.trim(),
                                    progress,
                                    step: currentStep,
                                    totalSteps,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        } else if (line.includes('FROM')) {
                            sendEvent({
                                stage: 'pulling',
                                message: 'Pulling base image...',
                                progress: 10,
                                timestamp: new Date().toISOString()
                            });
                        } else if (line.includes('RUN npm install')) {
                            sendEvent({
                                stage: 'installing',
                                message: 'Installing dependencies...',
                                progress: 40,
                                timestamp: new Date().toISOString()
                            });
                        } else if (line.includes('COPY')) {
                            sendEvent({
                                stage: 'copying',
                                message: 'Copying source code...',
                                progress: 70,
                                timestamp: new Date().toISOString()
                            });
                        } else if (line.includes('Successfully built') || line.includes('Successfully tagged')) {
                            sendEvent({
                                stage: 'complete',
                                message: 'Build complete!',
                                progress: 100,
                                timestamp: new Date().toISOString()
                            });
                        } else if (line.trim()) {
                            // Send other output as info
                            sendEvent({
                                stage: currentStage,
                                message: line.trim(),
                                progress: Math.round((currentStep / totalSteps) * 100),
                                timestamp: new Date().toISOString(),
                                raw: true
                            });
                        }
                    });
                });

                // Handle errors
                buildProcess.stderr.on('data', (data: Buffer) => {
                    const error = data.toString();
                    sendEvent({
                        stage: 'error',
                        message: error.trim(),
                        progress: 0,
                        timestamp: new Date().toISOString(),
                        error: true
                    });
                });

                // Handle completion
                buildProcess.on('close', (code) => {
                    if (code === 0) {
                        sendEvent({
                            stage: 'success',
                            message: 'Docker image built successfully!',
                            progress: 100,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        sendEvent({
                            stage: 'failed',
                            message: `Build failed with exit code ${code}`,
                            progress: 0,
                            timestamp: new Date().toISOString(),
                            error: true
                        });
                    }

                    controller.close();
                });

                // Handle client disconnect
                request.signal.addEventListener('abort', () => {
                    buildProcess.kill();
                    controller.close();
                });

            } catch (error: any) {
                sendEvent({
                    stage: 'error',
                    message: error.message || 'Unknown error occurred',
                    progress: 0,
                    timestamp: new Date().toISOString(),
                    error: true
                });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
