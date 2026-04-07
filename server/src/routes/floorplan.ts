import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

export function registerFloorPlanRoutes(app: FastifyInstance) {
  app.get('/api/floor-tables', () => {
    return getDb().prepare('SELECT * FROM floor_tables WHERE is_active = 1 ORDER BY id').all();
  });

  app.get('/api/floor-tables/all', () => {
    return getDb().prepare('SELECT * FROM floor_tables ORDER BY id').all();
  });

  app.post<{ Body: { label: string; type?: string; x?: number; y?: number; width?: number; height?: number; capacity?: number } }>('/api/floor-tables', (req) => {
    const db = getDb();
    const b = req.body;
    const defaults: Record<string, { w: number; h: number }> = {
      table: { w: 80, h: 80 },
      booth: { w: 120, h: 70 },
      bar: { w: 50, h: 50 },
      patio: { w: 90, h: 90 },
    };
    const d = defaults[b.type || 'table'] || defaults.table;
    const result = db.prepare(
      'INSERT INTO floor_tables (label, type, x, y, width, height, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(b.label, b.type || 'table', b.x || 100, b.y || 100, b.width || d.w, b.height || d.h, b.capacity || 4);
    return db.prepare('SELECT * FROM floor_tables WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: any }>('/api/floor-tables/:id', (req) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM floor_tables WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return { error: 'Not found' };
    const b = req.body;
    db.prepare('UPDATE floor_tables SET label=?, type=?, x=?, y=?, width=?, height=?, rotation=?, capacity=?, is_active=? WHERE id=?')
      .run(b.label ?? existing.label, b.type ?? existing.type, b.x ?? existing.x, b.y ?? existing.y,
        b.width ?? existing.width, b.height ?? existing.height, b.rotation ?? existing.rotation,
        b.capacity ?? existing.capacity, b.is_active ?? existing.is_active, req.params.id);
    return { ok: true };
  });

  // Batch update positions (for drag-and-drop save)
  app.put<{ Body: { tables: { id: number; x: number; y: number }[] } }>('/api/floor-tables/positions', (req) => {
    const db = getDb();
    const update = db.prepare('UPDATE floor_tables SET x = ?, y = ? WHERE id = ?');
    for (const t of req.body.tables) {
      update.run(t.x, t.y, t.id);
    }
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/floor-tables/:id', (req) => {
    getDb().prepare('DELETE FROM floor_tables WHERE id = ?').run(req.params.id);
    return { ok: true };
  });
}
