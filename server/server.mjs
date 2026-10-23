import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const APP_ID = 'dsh-project-board';
const VERSION = '0.1.0';
const PORT = Number(process.env.DSH_PROJECT_BOARD_PORT || 8791);
const PORT_TRIES = process.env.DSH_PROJECT_BOARD_PORT ? 1 : 10;
const PROJECTS_DIR = process.env.DSH_PROJECTS_DIR
  ? path.resolve(process.env.DSH_PROJECTS_DIR)
  : path.join(os.homedir(), 'Documents', 'Projects');
const STATE_DIR = process.env.DSH_PROJECT_BOARD_STATE_DIR
  ? path.resolve(process.env.DSH_PROJECT_BOARD_STATE_DIR)
  : path.join(os.homedir(), '.dsh', 'project-board');
const LAST_PROJECT_FILE = path.join(STATE_DIR, 'last_project.txt');
const TOKEN_FILE = path.join(STATE_DIR, 'token');

const MODULE_RE = /^##+\s+(?:([〇一二三四五六七八九0-9]+)[、.\s]*)?(.+?)\s*$/;
const CHECK_RE = /^(\s*)-\s+\[([ xX])\]\s+(.+?)\s*$/;
const STRIKE_RE = /~~(.+?)~~/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

const NON_MODULE_SECTIONS = new Set(['〇', '0', '十一', '11', '十二', '12', '十三', '13']);
const SPECIAL_TITLES = ['一眼看现状', '待决策事项台账', '待决策事项', '推进时间线与归档', '参考与附录', '推进历史', '维护约定'];

function plainText(text) {
  let res = text.replace(STRIKE_RE, '$1').replace(LINK_RE, '$1');
  return res.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function findBoardDoc(projDir) {
  if (!fs.existsSync(projDir) || !fs.statSync(projDir).isDirectory()) return null;
  const files = fs.readdirSync(projDir);
  const projName = path.basename(projDir);

  const candidates = [
    `${projName} 进度看板.md`,
    `${projName}进度看板.md`,
    `${projName} 项目看板.md`,
    `${projName}项目看板.md`
  ];
  for (const c of candidates) {
    if (files.includes(c)) return path.join(projDir, c);
  }
  for (const f of files) {
    if ((f.endsWith('进度看板.md') || f.endsWith('项目看板.md')) && !f.endsWith('.bak')) {
      return path.join(projDir, f);
    }
  }
  return null;
}

function findDecisionDoc(projDir) {
  if (!fs.existsSync(projDir) || !fs.statSync(projDir).isDirectory()) return null;
  const files = fs.readdirSync(projDir);
  const projName = path.basename(projDir);

  const candidates = [
    `${projName} 决策台账.md`,
    `${projName}决策台账.md`
  ];
  for (const c of candidates) {
    if (files.includes(c)) return path.join(projDir, c);
  }
  for (const f of files) {
    if (f.endsWith('决策台账.md') && !f.endsWith('.bak')) {
      return path.join(projDir, f);
    }
  }
  return null;
}

function parseDecisions(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hm = line.match(/^###\s+([A-Za-z0-9-]+)\s+(.+?)\s*$/);
    if (hm) {
      if (cur) blocks.push(cur);
      cur = { id: hm[1], title: hm[2], fields: {}, line: i };
      continue;
    }
    if (cur) {
      const fm = line.match(/^-\s*([^:：]+)[:：]\s*(.*)$/);
      if (fm) cur.fields[fm[1].trim()] = fm[2].trim();
    }
  }
  if (cur) blocks.push(cur);

  if (blocks.length > 0) {
    const items = blocks.map(b => {
      const nodeRaw = b.fields['节点'] || '';
      const nodeId = (nodeRaw.match(/^(\d{2})/) || [])[1] || '00';
      const nodeName = nodeRaw.replace(/^\d{2}\s*/, '').trim() || nodeId;
      const status = b.fields['状态'] || '生效';
      const rev = b.fields['可逆性'] || '';
      let tone = 'settled';
      if (status === '待拍板') tone = 'pending';
      else if (status === '已被取代' || status === '废弃') tone = 'muted';
      else if (rev === '不可逆') tone = 'danger';
      return {
        id: b.id,
        title: b.title,
        node: { id: nodeId, name: nodeName },
        status,
        date: b.fields['日期'] || '',
        reversible: rev,
        reason: b.fields['理由'] || '',
        alternatives: b.fields['备选'] || '',
        impact: b.fields['影响'] || '',
        review: b.fields['复审'] || '',
        successor: b.fields['取代者'] || '',
        partial: b.fields['部分取代'] || '',
        tone,
        line: b.line
      };
    });

    items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const groupMap = {};
    for (const it of items) {
      if (!groupMap[it.node.id]) groupMap[it.node.id] = { id: it.node.id, name: it.node.name, items: [] };
      groupMap[it.node.id].items.push(it);
    }
    const groups = Object.values(groupMap).sort((a, b) => a.id.localeCompare(b.id));

    return {
      total: items.length,
      pending: items.filter(x => x.status === '待拍板').length,
      settled: items.filter(x => x.status === '生效').length,
      superseded: items.filter(x => x.status === '已被取代' || x.status === '废弃').length,
      danger: items.filter(x => x.tone === 'danger').length,
      items,
      groups
    };
  }

  // 旧表格式回退（其他项目尚未迁移时）
  const items = [];
  const ROW = /^\|\s*(D\d+[a-z]?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(ROW);
    if (!m) continue;
    const rawReversibility = m[4].trim();
    let tone = 'settled';
    if (rawReversibility.includes('待授权') || rawReversibility.includes('待决策') || m[2].includes('待授权') || m[2].includes('待执行')) tone = 'pending';
    else if (rawReversibility.includes('不可逆')) tone = 'danger';
    else if (rawReversibility.includes('已撤销') || rawReversibility.includes('已废弃')) tone = 'muted';
    items.push({
      id: m[1].trim(), title: m[2].trim(), node: { id: '00', name: '未分组' },
      status: tone === 'pending' ? '待拍板' : tone === 'muted' ? '已被取代' : '生效',
      date: '', reversible: rawReversibility, reason: m[3].trim(),
      alternatives: '', impact: '', review: '', successor: '', partial: '',
      tone, line: i
    });
  }
  items.sort((a, b) => parseInt(b.id.replace(/\D/g, ''), 10) - parseInt(a.id.replace(/\D/g, ''), 10));
  return {
    total: items.length,
    pending: items.filter(x => x.tone === 'pending').length,
    settled: items.filter(x => x.tone === 'settled').length,
    superseded: items.filter(x => x.tone === 'muted').length,
    danger: items.filter(x => x.tone === 'danger').length,
    items,
    groups: items.length ? [{ id: '00', name: '未分组', items }] : []
  };
}

function ensureToken() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(TOKEN_FILE)) {
      fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    }
  } catch (e) {
    if (e.code !== 'EEXIST') console.warn('[project-board] token file:', e.message);
  }
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { return ''; }
}

const TOKEN = ensureToken();

function listProjectNames() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => !f.startsWith('.'))
    .filter(f => {
      try { return fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory(); } catch { return false; }
    });
}

function getLastProject() {
  const dirs = listProjectNames();
  try {
    if (fs.existsSync(LAST_PROJECT_FILE)) {
      const val = fs.readFileSync(LAST_PROJECT_FILE, 'utf8').trim();
      if (val && dirs.includes(val)) return val;
    }
  } catch {}
  return dirs[0] || '';
}

function resolveProject(name) {
  const dirs = listProjectNames();
  if (!name) return getLastProject();
  const trimmed = String(name).trim();
  return dirs.includes(trimmed) ? trimmed : null;
}

function setLastProject(name) {
  if (!name) return;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(LAST_PROJECT_FILE, name, 'utf8');
  } catch {}
}

function scanProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const entries = fs.readdirSync(PROJECTS_DIR);
  const projects = [];

  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const p = path.join(PROJECTS_DIR, name);
    try {
      if (!fs.statSync(p).isDirectory()) continue;
    } catch { continue; }

    const docPath = findBoardDoc(p);
    const has_board = docPath !== null;
    const decisionPath = findDecisionDoc(p);
    const has_decisions = decisionPath !== null;

    // 过滤掉既无看板也无决策台账的目录
    if (!has_board && !has_decisions) continue;

    let stats = { total: 0, done: 0, percent: 0 };

    if (docPath) {
      try {
        const content = fs.readFileSync(docPath, 'utf8');
        const lines = content.split(/\r?\n/);
        let total = 0;
        let done = 0;
        for (const l of lines) {
          const m = l.match(CHECK_RE);
          if (m) {
            total++;
            if (m[2].toLowerCase() === 'x') done++;
          }
        }
        stats = {
          total,
          done,
          percent: total > 0 ? Math.round((done / total) * 100) : 0
        };
      } catch {}
    }

    projects.push({
      id: name,
      name,
      has_board,
      doc: docPath ? path.basename(docPath) : null,
      doc_path: docPath,
      has_decisions,
      decision_doc: decisionPath ? path.basename(decisionPath) : null,
      decision_doc_path: decisionPath,
      stats
    });
  }

  return projects;
}

function parseBoard(lines) {
  const nodes = [];
  let current = null;
  let inFm = lines.length > 0 && lines[0].trim() === '---';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inFm) {
      if (i > 0 && line.trim() === '---') inFm = false;
      continue;
    }

    const hm = line.match(/^##\s+(\d{2})\s+(.+?)\s*$/);
    if (hm) {
      current = {
        id: hm[1],
        name: hm[2].replace(/\s*(完成|已上线|部分完成|未开始)\s*$/, '').trim(),
        scope: '',
        items: []
      };
      nodes.push(current);
      continue;
    }
    if (/^##\s+/.test(line)) { current = null; continue; }

    if (current && !current.scope) {
      const sm = line.match(/^>\s*范围[:：]\s*(.+?)\s*$/);
      if (sm) { current.scope = sm[1].trim(); continue; }
    }

    const cm = line.match(CHECK_RE);
    if (cm && current) {
      const raw = cm[3];
      const text = plainText(raw).replace(/\[\[(.+?)\]\]/g, '$1').replace(/·\s*关联[:：]\s*[A-Za-z0-9-]+/g, '').trim();
      const linkM = raw.match(/关联[:：]\s*([A-Za-z0-9-]+)/);
      current.items.push({
        line: i,
        done: cm[2].toLowerCase() === 'x',
        text,
        id: (raw.match(/\[(T-\d{2}-\d{2})\]/) || [])[1] || null,
        link: linkM ? linkM[1] : null,
        pending: /\[\[/.test(raw)
      });
    }
  }

  const valid = nodes.filter(n => n.items.length > 0);
  let total = 0, done = 0;
  for (const n of valid) {
    n.total = n.items.length;
    n.done = n.items.filter(x => x.done).length;
    n.open = n.total - n.done;
    n.pending = n.items.filter(x => x.pending && !x.done).length;
    total += n.total;
    done += n.done;
  }
  return {
    nodes: valid,
    stats: { total, done, open: total - done, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  };
}

function normalizeTaskText(s) {
  return String(s)
    .replace(/~~/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[\[(.+?)\]\]/g, '$1')
    .replace(/\[T-\d{2}-\d{2}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findTaskLine(lines, payload) {
  const { node, text, id, line, done } = payload;
  let current = null;
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      const hm = lines[i].match(/^##\s+(\d{2})\s+/);
      current = hm ? hm[1] : null;
      continue;
    }
    const m = lines[i].match(CHECK_RE);
    if (!m) continue;
    if (node && current !== node) continue;
    const raw = m[3];
    const hasId = id && raw.includes(`[${id}]`);
    const sameText = text && normalizeTaskText(raw) === normalizeTaskText(text);
    if (hasId || sameText) hits.push({ line: i, isDone: m[2].toLowerCase() === 'x' });
  }

  if (hits.length) {
    const preferred = hits.find(h => h.isDone !== done) || hits[0];
    return preferred.line;
  }

  // last resort: original line, only if it still proves it is the same task
  if (typeof line === 'number' && line >= 0 && line < lines.length) {
    const m = lines[line].match(CHECK_RE);
    if (m && (!text || normalizeTaskText(m[3]) === normalizeTaskText(text))) return line;
  }
  return null;
}

const ALLOWED_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGIN.test(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return;
  }
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Project-Board-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const [urlPath, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  if (urlPath.startsWith('/api/') && urlPath !== '/api/health') {
    const provided = req.headers['x-project-board-token'] || '';
    if (!TOKEN || provided !== TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  if (req.method === 'GET' && urlPath === '/api/health') {
    const addr = server.address();
    const body = Buffer.from(JSON.stringify({ app: APP_ID, version: VERSION, port: addr ? addr.port : null }));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    res.end(body);
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/projects') {
    const data = {
      projects: scanProjects(),
      active_project: getLastProject()
    };
    const body = Buffer.from(JSON.stringify(data));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    res.end(body);
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/board') {
    const activeProject = resolveProject(params.get('project'));
    if (!activeProject) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unknown project' }));
      return;
    }
    setLastProject(activeProject);

    const projDir = path.join(PROJECTS_DIR, activeProject);
    const docPath = findBoardDoc(projDir);
    const projects = scanProjects();

    let resData;
    if (!docPath) {
      resData = {
        project: activeProject,
          projects,
        has_board: false,
        doc: null,
        modules: [],
        stats: { total: 0, done: 0, open: 0, percent: 0 }
      };
    } else {
      const content = fs.readFileSync(docPath, 'utf8');
      const lines = content.split(/\r?\n/);
      resData = parseBoard(lines);
      resData.project = activeProject;
      resData.projects = projects;
      resData.has_board = true;
      resData.doc = path.basename(docPath);
      resData.doc_path = docPath;
    }

    const body = Buffer.from(JSON.stringify(resData));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    res.end(body);
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/decisions') {
    const activeProject = resolveProject(params.get('project'));
    if (!activeProject) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unknown project' }));
      return;
    }
    const projDir = path.join(PROJECTS_DIR, activeProject);
    const docPath = findDecisionDoc(projDir);
    const projects = scanProjects();

    let resData;
    if (!docPath) {
      resData = {
        project: activeProject,
          projects,
        has_decisions: false,
        doc: null,
        data: { total: 0, pending: 0, settled: 0, danger: 0, items: [] }
      };
    } else {
      const content = fs.readFileSync(docPath, 'utf8');
      const data = parseDecisions(content);
      resData = {
        project: activeProject,
          projects,
        has_decisions: true,
        doc: path.basename(docPath),
        doc_path: docPath,
        data
      };
    }

    const body = Buffer.from(JSON.stringify(resData));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    res.end(body);
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/toggle') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(raw || '{}');
        const activeProject = resolveProject(payload.project);
        if (!activeProject) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unknown project' }));
          return;
        }
        const projDir = path.join(PROJECTS_DIR, activeProject);
        const docPath = findBoardDoc(projDir);

        if (!docPath || !fs.existsSync(docPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project board document not found' }));
          return;
        }

        const content = fs.readFileSync(docPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const done = Boolean(payload.done);
        const lineIdx = findTaskLine(lines, payload);

        if (lineIdx === null) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Task changed; refresh and retry' }));
          return;
        }

        const targetLine = lines[lineIdx];
        const m = targetLine.match(CHECK_RE);
        if (!m) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target line is not a checklist item' }));
          return;
        }

        const indent = m[1];
        let taskBody = m[3].trim();
        taskBody = taskBody.replace(/^~~(.*)~~$/, '$1');
        if (done) {
          lines[lineIdx] = `${indent}- [x] ~~${taskBody}~~`;
        } else {
          lines[lineIdx] = `${indent}- [ ] ${taskBody}`;
        }

        fs.writeFileSync(docPath, lines.join('\n') + '\n', 'utf8');

        const resData = parseBoard(lines);
        resData.project = activeProject;
        resData.projects = scanProjects();
        resData.has_board = true;
        resData.doc = path.basename(docPath);
        resData.doc_path = docPath;

        const body = Buffer.from(JSON.stringify(resData));
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': body.length
        });
        res.end(body);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

let listenPort = PORT;
let listenAttempts = 0;
let activeErrorHandler = null;

function rememberPort(port) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(path.join(STATE_DIR, 'port'), String(port), 'utf8');
  } catch {}
}

server.on('listening', () => {
  if (activeErrorHandler) {
    server.removeListener('error', activeErrorHandler);
    activeErrorHandler = null;
  }
  const addr = server.address();
  const actual = addr ? addr.port : listenPort;
  rememberPort(actual);
  console.log(`[project-board] listening on 127.0.0.1:${actual}`);
  console.log(`[project-board] projects: ${PROJECTS_DIR}`);
});

function tryListen() {
  activeErrorHandler = (err) => {
    if (activeErrorHandler) {
      server.removeListener('error', activeErrorHandler);
      activeErrorHandler = null;
    }
    if (err.code === 'EADDRINUSE' && listenAttempts < PORT_TRIES - 1) {
      listenAttempts += 1;
      listenPort += 1;
      setTimeout(tryListen, 50);
      return;
    }
    console.error(`[project-board] cannot listen on 127.0.0.1:${listenPort}: ${err.message}`);
    process.exit(1);
  };
  server.once('error', activeErrorHandler);
  server.listen(listenPort, '127.0.0.1');
}

tryListen();
