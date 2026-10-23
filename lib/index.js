import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'server.mjs');
const SKILL_SRC = path.join(ROOT, 'skill');
const SKILL_DEST = process.env.DSH_PROJECT_BOARD_SKILL_DIR
  ? path.resolve(process.env.DSH_PROJECT_BOARD_SKILL_DIR)
  : path.join(os.homedir(), '.dsh', 'skills', 'project-board');
const STATE_DIR = process.env.DSH_PROJECT_BOARD_STATE_DIR
  ? path.resolve(process.env.DSH_PROJECT_BOARD_STATE_DIR)
  : path.join(os.homedir(), '.dsh', 'project-board');
const TOKEN_FILE = path.join(STATE_DIR, 'token');
const CLIENT = path.join(ROOT, 'client', 'client.js');
const MANIFEST_FILE = path.join(SKILL_DEST, '.manifest.json');

let child = null;

function ensureToken() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(TOKEN_FILE)) {
      fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    }
  } catch (e) {
    if (e.code !== 'EEXIST') console.warn('[dsh-project-board] token file:', e.message);
  }
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { return ''; }
}

function patchClient(token) {
  try {
    const src = fs.readFileSync(CLIENT, 'utf8');
    const next = src.replace(/const TOKEN = '[^']*';/, `const TOKEN = '${token}';`);
    if (next !== src) fs.writeFileSync(CLIENT, next, 'utf8');
  } catch (e) {
    console.warn('[dsh-project-board] client token patch skipped:', e.message);
  }
}

function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(abs, base, out);
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

function fileHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); } catch { return null; }
}

function installSkill() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const manifest = readManifest();
    if (manifest && manifest.version === pkg.version) return;

    // Legacy install without a manifest: replace once, then go incremental.
    if (!manifest && fs.existsSync(SKILL_DEST)) {
      fs.rmSync(SKILL_DEST, { recursive: true, force: true });
    }
    fs.mkdirSync(SKILL_DEST, { recursive: true });

    const old = (manifest && manifest.files) || {};
    const next = { version: pkg.version, files: {} };
    const rels = [];

    for (const src of walkFiles(SKILL_SRC)) {
      const rel = path.relative(SKILL_SRC, src);
      rels.push(rel);
      const dest = path.join(SKILL_DEST, rel);
      const srcHash = fileHash(src);
      const exists = fs.existsSync(dest);
      const destHash = exists ? fileHash(dest) : null;
      const oldHash = old[rel];
      const userEdited = exists && oldHash && destHash !== oldHash;

      if (!exists) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log('[dsh-project-board] skill add', rel);
      } else if (userEdited) {
        console.warn('[dsh-project-board] kept local skill edit:', rel);
        next.files[rel] = oldHash;
        continue;
      } else if (destHash !== srcHash) {
        fs.copyFileSync(src, dest);
        console.log('[dsh-project-board] skill update', rel);
      }
      next.files[rel] = fileHash(dest);
    }

    for (const rel of Object.keys(old)) {
      if (rels.includes(rel)) continue;
      const dest = path.join(SKILL_DEST, rel);
      if (!fs.existsSync(dest)) continue;
      if (fileHash(dest) === old[rel]) {
        fs.rmSync(dest, { force: true });
        console.log('[dsh-project-board] skill remove', rel);
      } else {
        console.warn('[dsh-project-board] kept edited stale skill file:', rel);
      }
    }

    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(next, null, 2), 'utf8');
    console.log('[dsh-project-board] skill synced', pkg.version, 'to', SKILL_DEST);
  } catch (e) {
    console.warn('[dsh-project-board] skill install skipped:', e.message);
  }
}

function startServer() {
  if (child) return;
  child = spawn(process.execPath, [SERVER], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  child.stdout.on('data', d => console.log('[dsh-project-board]', String(d).trim()));
  child.stderr.on('data', d => console.error('[dsh-project-board]', String(d).trim()));
  child.on('exit', code => {
    child = null;
    if (code) console.warn('[dsh-project-board] server exited with', code);
  });
}

function stopServer() {
  if (!child) return;
  child.kill();
  child = null;
}

export const name = 'dsh-project-board';

export function apply(ctx) {
  const token = ensureToken();
  patchClient(token);
  installSkill();
  startServer();
  if (ctx && typeof ctx.effect === 'function') {
    ctx.effect(() => stopServer);
  } else {
    process.on('exit', stopServer);
  }
}
