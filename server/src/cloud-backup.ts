import { getDb } from './db/connection.js';

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

function backupPath(): { folder: string; fileName: string } {
  const name = getRestaurantName().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  return { folder: name, fileName: `${date}_${time}.json` };
}

// ============================================================
// SUPABASE — kept for whoever already had it configured. Needs a
// service-role key, which is the most privileged credential a
// Supabase project has — fine for a project that ONLY holds POS
// backups, but never point this at a project that also runs
// something else, since that key bypasses every access rule it has.
// ============================================================
async function uploadToSupabase(jsonData: string): Promise<{ ok: boolean; message: string }> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');
  if (!supabaseUrl || !supabaseKey) return { ok: false, message: 'Supabase not configured' };

  const { folder, fileName } = backupPath();
  const path = `${folder}/${fileName}`;

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/pos-backups/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: jsonData,
    });
    if (!res.ok) return { ok: false, message: `Supabase upload failed: ${await res.text()}` };
    console.log(`[Backup] Uploaded to Supabase: ${path} (${(jsonData.length / 1024).toFixed(1)}KB)`);
    return { ok: true, message: `Supabase backup saved: ${path}` };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

async function listSupabaseBackups(): Promise<{ name: string; created_at: string; size: number; source: 'supabase' }[]> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');
  if (!supabaseUrl || !supabaseKey) return [];
  const { folder } = backupPath();
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/pos-backups`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: `${folder}/`, limit: 30, sortBy: { column: 'created_at', order: 'desc' } }),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows || []).map((r: any) => ({ ...r, source: 'supabase' as const }));
  } catch { return []; }
}

async function downloadFromSupabase(filePath: string): Promise<string | null> {
  const supabaseUrl = getSetting('supabase_url');
  const supabaseKey = getSetting('supabase_service_key');
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/pos-backups/${filePath}`, {
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ============================================================
// GITHUB — a private repo dedicated to nothing but these backups.
// Uses a token scoped to JUST that one repo (fine-grained PAT,
// Contents: read+write only) rather than anything with access to
// other projects, so a leaked/stolen laptop never exposes more than
// a folder of JSON snapshots of this restaurant's own data.
// ============================================================
function githubHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'WorldMenuPOS',
  };
}

async function uploadToGitHub(jsonData: string): Promise<{ ok: boolean; message: string }> {
  const repo = getSetting('github_backup_repo');   // "owner/repo"
  const token = getSetting('github_backup_token');
  if (!repo || !token) return { ok: false, message: 'GitHub backup not configured' };

  const { folder, fileName } = backupPath();
  const path = `${folder}/${fileName}`;
  const content = Buffer.from(jsonData, 'utf8').toString('base64');

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `backup: ${path}`, content }),
    });
    if (!res.ok) return { ok: false, message: `GitHub upload failed: ${await res.text()}` };
    console.log(`[Backup] Uploaded to GitHub: ${repo}/${path} (${(jsonData.length / 1024).toFixed(1)}KB)`);
    return { ok: true, message: `GitHub backup saved: ${path}` };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

async function listGitHubBackups(): Promise<{ name: string; created_at: string; size: number; source: 'github' }[]> {
  const repo = getSetting('github_backup_repo');
  const token = getSetting('github_backup_token');
  if (!repo || !token) return [];
  const { folder } = backupPath();
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${folder}`, { headers: githubHeaders(token) });
    if (res.status === 404) return [];   // no backups made yet -- folder doesn't exist
    if (!res.ok) return [];
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    // File names are the timestamp ("2026-09-01_04-12-00.json"), so the name itself
    // carries the date -- no need for an extra API call per file to fetch commit history.
    return files
      .filter((f: any) => f.name.endsWith('.json'))
      .map((f: any) => ({
        name: `${folder}/${f.name}`,
        created_at: f.name.replace('.json', '').replace('_', 'T').replace(/-(\d{2})$/, ':$1') + 'Z',
        size: f.size,
        source: 'github' as const,
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch { return []; }
}

async function downloadFromGitHub(filePath: string): Promise<string | null> {
  const repo = getSetting('github_backup_repo');
  const token = getSetting('github_backup_token');
  if (!repo || !token) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, { headers: githubHeaders(token) });
    if (!res.ok) return null;
    const data = await res.json();
    return Buffer.from(data.content, 'base64').toString('utf8');
  } catch { return null; }
}

// ============================================================
// PUBLIC API — unchanged shape, so the existing routes/UI (built
// around Supabase-only originally) keep working without edits;
// they just transparently gain GitHub as a second/alternate target.
// ============================================================

/** Run a manual (or scheduled) backup now, to whichever provider(s) are configured. */
export async function runBackupNow(): Promise<{ ok: boolean; message: string }> {
  const hasGitHub = !!(getSetting('github_backup_repo') && getSetting('github_backup_token'));
  const hasSupabase = !!(getSetting('supabase_url') && getSetting('supabase_service_key'));
  if (!hasGitHub && !hasSupabase) return { ok: false, message: 'No backup destination configured' };

  const data = exportDatabase();
  const results: string[] = [];
  let anyOk = false;

  if (hasGitHub) {
    const r = await uploadToGitHub(data);
    if (r.ok) anyOk = true;
    results.push(r.message);
  }
  if (hasSupabase) {
    const r = await uploadToSupabase(data);
    if (r.ok) anyOk = true;
    results.push(r.message);
  }
  return { ok: anyOk, message: results.join(' | ') };
}

export async function listBackups(): Promise<{ name: string; created_at: string; size: number; source: string }[]> {
  const [github, supabase] = await Promise.all([listGitHubBackups(), listSupabaseBackups()]);
  return [...github, ...supabase].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function downloadBackup(filePath: string): Promise<string | null> {
  // Try whichever is actually configured; a file only ever lives in one place, so
  // trying the other after a real network/API failure is harmless, not a fallback
  // that could return stale/wrong data.
  return (await downloadFromGitHub(filePath)) ?? (await downloadFromSupabase(filePath));
}

/** Start automatic backup — runs once on startup, then every 6 hours. */
export function startAutoBackup() {
  const configured = () => !!((getSetting('github_backup_repo') && getSetting('github_backup_token'))
    || (getSetting('supabase_url') && getSetting('supabase_service_key')));

  setTimeout(async () => {
    if (!configured()) return;
    console.log('[Backup] Running startup backup...');
    const result = await runBackupNow();
    if (!result.ok) console.error('[Backup] Startup backup failed:', result.message);
  }, 60000);

  setInterval(async () => {
    if (!configured()) return;
    console.log('[Backup] Running scheduled backup...');
    const result = await runBackupNow();
    if (!result.ok) console.error('[Backup] Scheduled backup failed:', result.message);
  }, 6 * 60 * 60 * 1000);
}
