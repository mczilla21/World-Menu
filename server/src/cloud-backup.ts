import { getDb } from './db/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getSetting(key: string): string {
  try {
    return (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as any)?.value || '';
  } catch { return ''; }
}

function getRestaurantName(): string {
  return getSetting('restaurant_name') || 'restaurant';
}

/** Export the entire database as JSON */
function exportDatabase(): string {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
  const data: Record<string, any[]> = {};
  for (const t of tables) {
    data[t.name] = db.prepare(`SELECT * FROM ${t.name}`).all();
  }
  return JSON.stringify(data);
}

/** Upload backup to Supabase Storage */
async function uploadToSupabase(jsonData: string): Promise<{ ok: boolean; message: string }> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');

  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, message: 'Supabase not configured' };
  }

  const name = getRestaurantName().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  const fileName = `${name}/${date}_${time}.json`;

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/pos-backups/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: jsonData,
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: `Upload failed: ${err}` };
    }

    console.log(`[Backup] Uploaded to Supabase: ${fileName} (${(jsonData.length / 1024).toFixed(1)}KB)`);
    return { ok: true, message: `Backup saved: ${fileName}` };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

/** List available backups from Supabase */
export async function listBackups(): Promise<{ name: string; created_at: string; size: number }[]> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');
  if (!supabaseUrl || !supabaseKey) return [];

  const name = getRestaurantName().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/pos-backups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: `${name}/`, limit: 30, sortBy: { column: 'created_at', order: 'desc' } }),
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Download a specific backup from Supabase */
export async function downloadBackup(filePath: string): Promise<string | null> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/pos-backups/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Run a manual backup now */
export async function runBackupNow(): Promise<{ ok: boolean; message: string }> {
  try {
    const data = exportDatabase();
    return await uploadToSupabase(data);
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

/** Start automatic daily backup — runs at 4am and on startup */
export function startAutoBackup() {
  // Backup on startup (after 60 seconds to let everything initialize)
  setTimeout(async () => {
    const supabaseUrl = getSetting('supabase_url');
    if (supabaseUrl) {
      console.log('[Backup] Running startup backup...');
      const result = await runBackupNow();
      if (!result.ok) console.error('[Backup] Startup backup failed:', result.message);
    }
  }, 60000);

  // Backup every 6 hours
  setInterval(async () => {
    const supabaseUrl = getSetting('supabase_url');
    if (supabaseUrl) {
      console.log('[Backup] Running scheduled backup...');
      const result = await runBackupNow();
      if (!result.ok) console.error('[Backup] Scheduled backup failed:', result.message);
    }
  }, 6 * 60 * 60 * 1000);
}
