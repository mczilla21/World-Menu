import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

let settingsCache: Record<string, string> | null = null;

export function registerSettingsRoutes(app: FastifyInstance) {
  // Get all settings (cached in memory to reduce DB reads on low-spec hardware)
  app.get('/api/settings', () => {
    if (settingsCache) return settingsCache;
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    settingsCache = result;
    return result;
  });

  // Employee auth check for settings — skip if no employees exist (first-time setup)
  function requireEmployeePin(req: any, reply: any): boolean {
    const db = getDb();
    const empCount = (db.prepare("SELECT COUNT(*) as c FROM employees").get() as any)?.c || 0;
    if (empCount === 0) return true; // First-time setup, no employees yet
    const pin = req.body?.pin;
    if (!pin) { reply.code(401).send({ error: 'Employee PIN required' }); return false; }
    const emp = db.prepare("SELECT id, role FROM employees WHERE pin = ? AND is_active = 1").get(pin) as any;
    if (!emp) { reply.code(403).send({ error: 'Invalid PIN' }); return false; }
    if (!['manager', 'owner'].includes(emp.role)) { reply.code(403).send({ error: 'Manager or owner access required' }); return false; }
    return true;
  }

  // Update a setting
  app.put<{ Params: { key: string }; Body: { value: string; pin?: string } }>('/api/settings/:key', (req, reply) => {
    if (!requireEmployeePin(req, reply)) return;
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(req.params.key, req.body.value);
    settingsCache = null;
    broadcastToAll({ type: 'SETTINGS_UPDATED' });
    return { ok: true };
  });

  // Batch update settings
  app.put<{ Body: Record<string, string> }>('/api/settings', (req, reply) => {
    if (!requireEmployeePin(req, reply)) return;
    const db = getDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'pin') continue; // Don't store the auth pin as a setting
      upsert.run(key, value);
    }
    settingsCache = null;
    broadcastToAll({ type: 'SETTINGS_UPDATED' });
    return { ok: true };
  });
}
