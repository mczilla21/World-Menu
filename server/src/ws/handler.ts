import type { FastifyInstance } from 'fastify';
import { addClient, removeClient } from './broadcast.js';

export function registerWebSocket(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const role = url.searchParams.get('role') || 'server';

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    addClient(role, socket);
    console.log(`  ✓ ${role} connected from ${ip}`);

    socket.on('close', () => {
      removeClient(role, socket);
      console.log(`  ✗ ${role} disconnected from ${ip}`);
    });

    socket.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });
  });
}
