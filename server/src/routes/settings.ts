import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

export function registerSettingsRoutes(app: FastifyInstance) {
  // Get all settings
  app.get('/api/settings', () => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  });

  // Update a setting
  app.put<{ Params: { key: string }; Body: { value: string } }>('/api/settings/:key', (req) => {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(req.params.key, req.body.value);
    broadcastToAll({ type: 'SETTINGS_UPDATED' });
    return { ok: true };
  });

  // Batch update settings
  app.put<{ Body: Record<string, string> }>('/api/settings', (req) => {
    const db = getDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(req.body)) {
      upsert.run(key, value);
    }
    broadcastToAll({ type: 'SETTINGS_UPDATED' });
    return { ok: true };
  });
}
