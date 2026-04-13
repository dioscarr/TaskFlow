import { WebSocketServer } from 'ws';
import prisma from './prisma';
import { deepSerialize } from './serialization';

// Keep a global singleton so hot reload/server actions don't re-bind the port
// and avoid EADDRINUSE when the module is re-evaluated.
type ProcessWssGlobals = {
  __process_wss?: WebSocketServer | null;
  __process_wss_init?: boolean;
  __process_wss_error?: Error | null;
  __process_wss_port?: number;
};

const g = globalThis as typeof globalThis & ProcessWssGlobals;

let wss: WebSocketServer | null = g.__process_wss ?? null;
let initAttempted = g.__process_wss_init ?? false;
let initError: Error | null = g.__process_wss_error ?? null;

const PORT = Number(process.env.PROCESS_WS_PORT || 4001);

function getWss() {
  // If we already have a working instance, return it
  if (wss) return wss;

  // If we already tried and failed, don't keep retrying
  if (initAttempted && initError) {
    return null;
  }

  initAttempted = true;

  try {
    wss = new WebSocketServer({ port: PORT });
    wss.on('connection', (socket) => {
      socket.on('message', () => { });
      socket.on('error', () => { });
    });

    wss.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('WebSocket server error:', error);
    });

    // eslint-disable-next-line no-console
    console.log(`Process WebSocket server running on ws://localhost:${PORT}`);
    initError = null;

    // Persist on global to survive module reloads
    g.__process_wss = wss;
    g.__process_wss_init = initAttempted;
    g.__process_wss_error = initError;
    g.__process_wss_port = PORT;
  } catch (e) {
    initError = e as Error;
    // eslint-disable-next-line no-console
    console.error('Could not start Process WebSocket server:', e);
    // If the port is already in use, try to reuse an existing global instance
    if ((initError as any)?.code === 'EADDRINUSE' && g.__process_wss) {
      wss = g.__process_wss;
      return wss;
    }

    wss = null;
    g.__process_wss = null;
    g.__process_wss_error = initError;
    g.__process_wss_init = initAttempted;
    g.__process_wss_port = PORT;
  }

  return wss;
}

export async function broadcastProcesses() {
  try {
    const server = getWss();
    if (!server) return;

    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    if (!user) return;
    const processes = await prisma.processRegistry.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });

    const payload = JSON.stringify({ type: 'processes', data: deepSerialize(processes) });

    server.clients.forEach((client) => {
      if (client.readyState === 1) { // 1 is OPEN in ws
        client.send(payload);
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to broadcast processes via websocket', e);
  }
}

export function getProcessSocketPort() {
  return PORT;
}
