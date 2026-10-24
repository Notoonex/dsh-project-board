import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = 18791;
const base = `http://127.0.0.1:${port}`;
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-state-'));
const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-projects-'));
fs.cpSync(path.join(root, 'examples', 'demo'), path.join(projectsDir, 'demo'), { recursive: true });

const child = spawn(process.execPath, [path.join(root, 'server', 'server.mjs')], {
  env: {
    ...process.env,
    DSH_PROJECTS_DIR: projectsDir,
    DSH_PROJECT_BOARD_STATE_DIR: stateDir,
    DSH_PROJECT_BOARD_PORT: String(port)
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', d => process.stdout.write(String(d)));
child.stderr.on('data', d => process.stderr.write(String(d)));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

try {
  await waitForServer();

  const health = await fetch(`${base}/api/health`).then(r => r.json());
  if (health.app !== 'dsh-project-board') throw new Error('health endpoint mismatch');
  console.log('✔ health endpoint');

  const token = fs.readFileSync(path.join(stateDir, 'token'), 'utf8').trim();
  const auth = { 'X-Project-Board-Token': token };

  const noToken = await fetch(`${base}/api/projects`);
  if (noToken.status !== 401) throw new Error(`missing token not rejected: ${noToken.status}`);
  console.log('✔ missing token rejected (401)');

  const board = await fetch(`${base}/api/board?project=demo`, { headers: auth });
  if (!board.ok) throw new Error(`board status ${board.status}`);
  const bd = await board.json();
  if (!Array.isArray(bd.nodes) || bd.nodes.length < 3) throw new Error('board nodes missing');
  console.log(`✔ board api: ${bd.nodes.length} nodes`);

  const bad = await fetch(`${base}/api/board?project=${encodeURIComponent('../../etc')}`, { headers: auth });
  if (bad.status !== 404) throw new Error(`path traversal not blocked: ${bad.status}`);
  console.log('✔ path traversal blocked');

  const evil = await fetch(`${base}/api/projects`, { headers: { ...auth, Origin: 'https://evil.example' } });
  if (evil.status !== 403) throw new Error(`remote origin not rejected: ${evil.status}`);
  console.log('✔ remote origin rejected (403)');

  const local = await fetch(`${base}/api/projects`, { headers: { ...auth, Origin: 'http://127.0.0.1:12345' } });
  if (local.headers.get('access-control-allow-origin') !== 'http://127.0.0.1:12345') {
    throw new Error('local origin not allowed');
  }
  console.log('✔ local origin allowed');

  const dshApp = await fetch(`${base}/api/projects`, { headers: { ...auth, Origin: 'dsh-app://dsh' } });
  if (dshApp.headers.get('access-control-allow-origin') !== 'dsh-app://dsh') {
    throw new Error('dsh-app origin not allowed');
  }
  console.log('✔ dsh-app origin allowed');

  const dec = await fetch(`${base}/api/decisions?project=demo`, { headers: auth });
  if (!dec.ok) throw new Error(`decisions status ${dec.status}`);
  const dd = await dec.json();
  if (!dd.data || dd.data.total < 2) throw new Error('decisions missing');
  console.log(`✔ decisions api: ${dd.data.total} items`);

  // Content-based toggle: insert a line above the target, then toggle using the old line number.
  const boardPath = path.join(projectsDir, 'demo', 'demo 进度看板.md');
  const lines = fs.readFileSync(boardPath, 'utf8').split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('首屏文案定稿'));
  if (idx < 0) throw new Error('target task not found');
  const text = lines[idx].replace(/^-\s+\[[ xX]\]\s+/, '').replace(/~~/g, '').trim();
  lines.splice(idx, 0, '- [ ] 临时插入的新任务');
  fs.writeFileSync(boardPath, lines.join('\n') + '\n', 'utf8');

  const toggle = await fetch(`${base}/api/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ project: 'demo', line: idx, done: true, node: '20', text, id: null })
  });
  if (!toggle.ok) throw new Error(`toggle status ${toggle.status}`);
  const after = await toggle.json();
  const items = after.nodes.flatMap(n => n.items);
  const target = items.find(i => i.text.includes('首屏文案定稿'));
  const inserted = items.find(i => i.text.includes('临时插入的新任务'));
  if (!target || !target.done) throw new Error('target task was not toggled');
  if (!inserted || inserted.done) throw new Error('inserted task was toggled by mistake');
  console.log('✔ content-based toggle after line shift');

  // Markdown links and backticks must survive the done toggle.
  const mdLines = fs.readFileSync(boardPath, 'utf8').split(/\r?\n/);
  const mdIdx = mdLines.findIndex(l => l.includes('首屏文案定稿')) + 1;
  const mdText = '保留格式 [文档](https://example.com) 和 `abc123`';
  mdLines.splice(mdIdx, 0, `- [ ] ${mdText}`);
  fs.writeFileSync(boardPath, mdLines.join('\n') + '\n', 'utf8');

  const mdToggle = await fetch(`${base}/api/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ project: 'demo', line: mdIdx, done: true, node: '20', text: mdText, id: null })
  });
  if (!mdToggle.ok) throw new Error(`markdown toggle status ${mdToggle.status}`);
  const mdLine = fs.readFileSync(boardPath, 'utf8').split(/\r?\n/).find(l => l.includes('保留格式'));
  if (!mdLine.includes('[文档](https://example.com)')) throw new Error('markdown link lost on toggle');
  if (!mdLine.includes('`abc123`')) throw new Error('backtick lost on toggle');
  if (!mdLine.startsWith('- [x] ~~')) throw new Error('done marker missing');
  console.log('✔ markdown preserved on toggle');
} finally {
  child.kill();
  fs.rmSync(projectsDir, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
}
