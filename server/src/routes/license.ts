import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

export function registerLicenseRoutes(app: FastifyInstance) {
  // Check license
  app.get('/api/license', () => {
    const key = (getDb().prepare("SELECT value FROM settings WHERE key = 'license_key'").get() as any)?.value || '';
    if (!key) return { valid: false, plan: 'demo', demo: true };
    if (key === 'OWNER') return { valid: true, plan: 'owner', demo: false };
    if (key.startsWith('WM-')) return { valid: true, plan: 'pro', demo: false };
    return { valid: false, plan: 'demo', demo: true };
  });
}

export function startLicenseChecker() {}
