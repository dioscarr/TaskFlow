import WebSocket from 'ws';
import prisma from './prisma';
import { deepSerialize } from './serialization';

let wss: WebSocket.Server | null = null;

const PORT = Number(process.env.PROCESS_WS_PORT || 4001);

function getWss() {
  if (wss) return wss;

  try {
    wss = new WebSocket.Server({ port: PORT });
    wss.on('connection', (socket) => {
      socket.on('message', () => {});
      socket.on('error', () => {});
    });
    // eslint-disable-next-line no-console
    console.log(`Process WebSocket server running on ws://localhost:${PORT}`);
  } catch (e) {
    // ignore (maybe already running)
    // eslint-disable-next-line no-console
    console.warn('Could not start Process WebSocket server', e);
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
      if (client.readyState === WebSocket.OPEN) {
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
