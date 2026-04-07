import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToRole, broadcastToTable } from '../ws/broadcast.js';

export function registerServiceRoutes(app: FastifyInstance) {
  // === Call Waiter ===
  app.post<{ Body: { table_number: string; type?: string } }>('/api/service/call-waiter', (req) => {
    const db = getDb();
    const { table_number } = req.body;
    const call_type = req.body.type || 'waiter';
    const result = db.prepare(
      "INSERT INTO service_calls (table_number, call_type) VALUES (?, ?)"
    ).run(table_number, call_type);
    const call = db.prepare('SELECT * FROM service_calls WHERE id = ?').get(result.lastInsertRowid);
    broadcastToRole('server', { type: 'WAITER_CALLED', call });
    broadcastToTable(table_number, { type: 'WAITER_CALL_CONFIRMED' });
    return { ok: true, id: Number(result.lastInsertRowid) };
  });

  app.get('/api/service/calls', () => {
    return getDb().prepare(
      "SELECT * FROM service_calls WHERE status = 'pending' ORDER BY created_at ASC"
    ).all();
  });

  app.patch<{ Params: { id: string } }>('/api/service/calls/:id/resolve', (req) => {
    const db = getDb();
    db.prepare(
      "UPDATE service_calls SET status = 'resolved', resolved_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(req.params.id);
    const call = db.prepare('SELECT * FROM service_calls WHERE id = ?').get(Number(req.params.id)) as any;
    broadcastToRole('server', { type: 'CALL_RESOLVED', callId: Number(req.params.id) });
    if (call?.table_number) {
      broadcastToTable(call.table_number, { type: 'CALL_RESOLVED' });
    }
    return { ok: true };
  });

  // === Packaging Options ===
  app.get('/api/packaging-options', () => {
    return getDb().prepare('SELECT * FROM packaging_options WHERE is_active = 1 ORDER BY sort_order, id').all();
  });

  app.post<{ Body: { name: string; sort_order?: number } }>('/api/packaging-options', (req) => {
    const db = getDb();
    const { name, sort_order = 0 } = req.body;
    const result = db.prepare('INSERT INTO packaging_options (name, sort_order) VALUES (?, ?)').run(name, sort_order);
    return db.prepare('SELECT * FROM packaging_options WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: { name?: string; sort_order?: number; is_active?: boolean } }>(
    '/api/packaging-options/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM packaging_options WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      db.prepare('UPDATE packaging_options SET name=?, sort_order=?, is_active=? WHERE id=?')
        .run(req.body.name ?? existing.name, req.body.sort_order ?? existing.sort_order,
          req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active, req.params.id);
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>('/api/packaging-options/:id', (req) => {
    getDb().prepare('DELETE FROM packaging_options WHERE id = ?').run(req.params.id);
    return { ok: true };
  });
}
