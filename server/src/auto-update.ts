import { getDb } from './db/connection.js';
import { broadcastToAll } from './ws/broadcast.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseName: string;
  releaseDate: string;
  releaseUrl: string;
  message?: string;
}

function getLocalVersion(): string {
  try {
    const vFile = path.join(PROJECT_ROOT, 'version.json');
    return JSON.parse(fs.readFileSync(vFile, 'utf8')).version || '0.0.0';
  } catch { return '0.0.0'; }
}

const DEFAULT_REPO = 'mczilla21/World-Menu';

function getGithubRepo(): string {
  try {
    const val = (getDb().prepare("SELECT value FROM settings WHERE key = 'github_repo'").get() as any)?.value;
    return val || DEFAULT_REPO;
  } catch { return DEFAULT_REPO; }
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = getLocalVersion();
  const repo = getGithubRepo();

  if (!repo) {
    return { available: false, currentVersion, latestVersion: '', downloadUrl: '', releaseName: '', releaseDate: '', releaseUrl: '' };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'WorldMenuPOS' },
    });

    if (!res.ok) {
      return { available: false, currentVersion, latestVersion: '', downloadUrl: '', releaseName: '', releaseDate: '', releaseUrl: '', message: `GitHub returned ${res.status}` };
    }

    const release = await res.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');

    // Compare versions
    const current = currentVersion.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);
    let available = false;
    for (let i = 0; i < 3; i++) {
      if ((latest[i] || 0) > (current[i] || 0)) { available = true; break; }
      if ((latest[i] || 0) < (current[i] || 0)) break;
    }

    return {
      available,
      currentVersion,
      latestVersion,
      downloadUrl: release.zipball_url || '',
      releaseName: release.name || '',
      releaseDate: release.published_at || '',
      releaseUrl: release.html_url || '',
    };
  } catch (err: any) {
    return { available: false, currentVersion, latestVersion: '', downloadUrl: '', releaseName: '', releaseDate: '', releaseUrl: '', message: err.message || 'Network error' };
  }
}

export async function downloadAndApplyUpdate(): Promise<{ ok: boolean; message: string }> {
  const info = await checkForUpdate();
  if (!info.available || !info.downloadUrl) {
    return { ok: false, message: 'No update available' };
  }

  const repo = getGithubRepo();
  if (!repo) return { ok: false, message: 'No GitHub repo configured' };

  try {
    // Download the zip
    console.log(`Downloading update v${info.latestVersion}...`);
    const res = await fetch(info.downloadUrl, {
      headers: { 'User-Agent': 'WorldMenuPOS', 'Accept': 'application/vnd.github.v3+json' },
      redirect: 'follow',
    });

    if (!res.ok) return { ok: false, message: 'Download failed: ' + res.status };

    const buffer = Buffer.from(await res.arrayBuffer());
    const zipPath = path.join(PROJECT_ROOT, 'update-download.zip');
    fs.writeFileSync(zipPath, buffer);
    console.log(`Downloaded ${buffer.length} bytes`);

    // Extract using PowerShell (Windows) or unzip
    const extractDir = path.join(PROJECT_ROOT, 'update-temp');
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });

    const { execSync } = await import('child_process');
    fs.mkdirSync(extractDir, { recursive: true });
    // Try tar first (built into Windows 10/11), then PowerShell, then unzip
    let extracted = false;
    for (const cmd of [
      `tar -xf "${zipPath}" -C "${extractDir}"`,
      `powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
      `unzip -o "${zipPath}" -d "${extractDir}"`,
    ]) {
      try {
        execSync(cmd, { timeout: 120000, stdio: 'pipe' });
        extracted = true;
        console.log('Extracted with: ' + cmd.split(' ')[0]);
        break;
      } catch { continue; }
    }
    if (!extracted) return { ok: false, message: 'Failed to extract update — no extraction tool available' };

    // Find the extracted folder (GitHub zips have a subfolder)
    const extractedEntries = fs.readdirSync(extractDir);
    const subDir = extractedEntries.length === 1 ? path.join(extractDir, extractedEntries[0]) : extractDir;

    // Copy new files over (skip node_modules, database, uploads)
    const copyRecursive = (src: string, dest: string) => {
      if (!fs.existsSync(src)) return;
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip these — protect user data
        if (['node_modules', '.git', 'restaurant.db', 'restaurant.db-shm', 'restaurant.db-wal', 'update-download.zip', 'update-temp', 'data'].includes(entry.name)) continue;
        // Skip uploads folder inside server/ (user's food photos)
        if (entry.name === 'uploads' && (src.includes('server') || src.includes('data'))) continue;

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(subDir, PROJECT_ROOT);
    console.log('Files updated');

    // Cleanup
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });

    // Rebuild client
    console.log('Rebuilding client...');
    try {
      execSync('npx vite build', { cwd: path.join(PROJECT_ROOT, 'client'), timeout: 120000 });
      // Copy public assets
      const distDir = path.join(PROJECT_ROOT, 'client', 'dist');
      const publicDir = path.join(PROJECT_ROOT, 'client', 'public');
      for (const f of ['manifest.json', 'embed.js']) {
        const src = path.join(publicDir, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, f));
      }
      console.log('Client rebuilt');
    } catch (e) {
      console.error('Client rebuild failed — update applied but needs manual build');
    }

    // Broadcast to all clients
    broadcastToAll({ type: 'APP_UPDATED', version: info.latestVersion });

    return { ok: true, message: `Updated to v${info.latestVersion}! Close this window and reopen START.bat to finish.` };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Update failed' };
  }
}

// Periodic check — runs twice a day
export function startUpdateChecker() {
  // Check on startup (after 30 seconds to let everything initialize)
  setTimeout(async () => {
    const info = await checkForUpdate();
    if (info.available) {
      console.log(`Update available: v${info.latestVersion} (current: v${info.currentVersion})`);
      broadcastToAll({ type: 'UPDATE_AVAILABLE', ...info });
    }
  }, 30000);

  // Check every 12 hours
  setInterval(async () => {
    const info = await checkForUpdate();
    if (info.available) {
      broadcastToAll({ type: 'UPDATE_AVAILABLE', ...info });
    }
  }, 12 * 60 * 60 * 1000);
}
