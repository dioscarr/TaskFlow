import { WebSocketServer } from 'ws';
import prisma from './prisma';
import { deepSerialize } from './serialization';

let wss: WebSocketServer | null = null;
let initAttempted = false;
let initError: Error | null = null;

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
  } catch (e) {
    initError = e as Error;
    // eslint-disable-next-line no-console
    console.error('Could not start Process WebSocket server:', e);
    wss = null;
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
