#!/usr/bin/env node
/**
 * project-board lint
 * usage: node lint.mjs <project-dir> [--json]
 *
 * 校验：
 *  - 文件配对（各恰好一个、stem 一致、frontmatter project 一致）
 *  - 节点注册表 ↔ ## 标题 对齐
 *  - 任务归属、决策引用、编号一致性
 *  - 看板/台账职责分离（看板不放决策，台账不放任务）
 *  - 陈旧待拍板
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirArg = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');

if (!dirArg) {
  console.error('usage: node lint.mjs <project-dir> [--json]');
  process.exit(2);
}

const dir = path.resolve(dirArg);
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`not a directory: ${dir}`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const info = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

let boardFile = null;
let ledgerFile = null;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
const boards = files.filter(f => f.endsWith(' 进度看板.md'));
const ledgers = files.filter(f => f.endsWith(' 决策台账.md'));

if (boards.length === 1) boardFile = boards[0];
else err(boards.length === 0 ? '缺少 * 进度看板.md' : `进度看板不唯一：${boards.join(' / ')}`);

if (ledgers.length === 1) ledgerFile = ledgers[0];
else err(ledgers.length === 0 ? '缺少 * 决策台账.md' : `决策台账不唯一：${ledgers.join(' / ')}`);

if (!boardFile || !ledgerFile) finish();

const boardStem = boardFile.replace(/\s*进度看板\.md$/, '');
const ledgerStem = ledgerFile.replace(/\s*决策台账\.md$/, '');
if (boardStem !== ledgerStem) err(`stem 不一致：${boardFile} ↔ ${ledgerFile}`);

const boardText = fs.readFileSync(path.join(dir, boardFile), 'utf8');
const ledgerText = fs.readFileSync(path.join(dir, ledgerFile), 'utf8');

function getFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function fmValue(fm, key) {
  if (!fm) return null;
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function parseNodes(fm) {
  const out = [];
  if (!fm) return out;
  let on = false;
  for (const line of fm.split(/\r?\n/)) {
    if (/^nodes:\s*$/.test(line)) { on = true; continue; }
    if (!on) continue;
    if (/^\S/.test(line)) { on = false; continue; }
    const m = line.match(/^\s+"?(\d{2})"?\s*:\s*(.+?)\s*$/);
    if (m) out.push({ id: m[1], name: m[2].replace(/^["']|["']$/g, '') });
  }
  return out;
}

const boardFm = getFrontmatter(boardText);
const ledgerFm = getFrontmatter(ledgerText);
if (!boardFm) err(`${boardFile} 缺少 frontmatter`);
if (!ledgerFm) err(`${ledgerFile} 缺少 frontmatter`);

const boardSchema = fmValue(boardFm, 'schema');
const boardProject = fmValue(boardFm, 'project');
const archetype = fmValue(boardFm, 'archetype');

if (boardSchema !== 'project-board/1') err(`看板 schema 应为 project-board/1，实际：${boardSchema || '缺失'}`);
if (!boardProject) err('看板 frontmatter 缺少 project');
else if (boardProject !== boardStem) err(`看板 project (${boardProject}) 与文件名 stem (${boardStem}) 不一致`);
if (!archetype) warn('看板 frontmatter 缺少 archetype');

const ledgerSchema = fmValue(ledgerFm, 'schema');
const ledgerProject = fmValue(ledgerFm, 'project');
if (ledgerSchema !== 'decision-log/1') err(`台账 schema 应为 decision-log/1，实际：${ledgerSchema || '缺失'}`);
if (!ledgerProject) err('台账 frontmatter 缺少 project');
else if (ledgerProject !== boardStem) err(`台账 project (${ledgerProject}) 与看板 stem (${boardStem}) 不一致`);

const nodes = parseNodes(boardFm);
const nodeIds = new Set(nodes.map(n => n.id));
if (!nodes.length) err('节点注册表为空');
if (nodeIds.size !== nodes.length) err('节点注册表有重复编号');
for (const n of nodes) if (!/^\d{2}$/.test(n.id)) err(`节点编号不是两位：${n.id}`);

const headings = [];
const headingRe = /^##\s+(\d{2})\s+(.+?)\s*$/gm;
let hm;
while ((hm = headingRe.exec(boardText))) headings.push({ id: hm[1], name: hm[2].trim() });
const headingIds = new Set(headings.map(h => h.id));
if (headingIds.size !== headings.length) err('看板有重复的 ## 节点标题');
for (const h of headings) if (!nodeIds.has(h.id)) err(`看板标题 ${h.id} 不在注册表里`);
for (const n of nodes) {
  if (!headingIds.has(n.id)) err(`注册表节点 ${n.id} ${n.name} 没有对应的 ## 标题`);
  const h = headings.find(x => x.id === n.id);
  if (h && h.name !== n.name) warn(`节点 ${n.id} 名称不一致：注册表「${n.name}」 vs 标题「${h.name}」`);
}
if (nodes.length && nodes.length < 3) warn(`节点过少（${nodes.length}）`);
if (nodes.length > 15) warn(`节点过多（${nodes.length}），考虑合并`);

if (/^###\s+D-/m.test(boardText) || /^###\s+D\d+/m.test(boardText)) {
  err('看板里出现了决策条目，决策应只写在台账');
}

const tasks = [];
let current = null;
const lines = boardText.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^##\s+/.test(line)) {
    const m = line.match(/^##\s+(\d{2})\s+/);
    current = m ? m[1] : null;
    continue;
  }
  const t = line.match(/^-\s+\[([ xX])\]\s+(.+?)\s*$/);
  if (!t) continue;
  const text = t[2];
  const linkM = text.match(/关联:\s*([A-Za-z0-9-]+)/);
  tasks.push({
    node: current,
    done: t[1].toLowerCase() === 'x',
    text,
    link: linkM ? linkM[1] : null,
    line: i + 1
  });
  if (!current) err(`任务不在任何 ## 节点下（第 ${i + 1} 行）`);
}

const decs = [];
const starts = [];
const dRe = /^###\s+([A-Za-z0-9-]+)\s+(.+?)\s*$/gm;
let dm;
while ((dm = dRe.exec(ledgerText))) starts.push({ id: dm[1], title: dm[2], index: dm.index });

for (let i = 0; i < starts.length; i++) {
  const s = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1].index : ledgerText.length;
  const body = ledgerText.slice(s.index, end);
  const fields = {};
  for (const line of body.split(/\r?\n/).slice(1)) {
    const m = line.match(/^-\s*([^:：]+)[:：]\s*(.*)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  decs.push({ id: s.id, title: s.title, fields });
}

const decIds = new Set();
for (const d of decs) {
  if (decIds.has(d.id)) err(`决策 ID 重复：${d.id}`);
  decIds.add(d.id);

  const nodeField = d.fields['节点'];
  const status = d.fields['状态'];
  const date = d.fields['日期'];

  if (!nodeField) err(`${d.id} 缺少「节点」`);
  else {
    const nid = (nodeField.match(/^(\d{2})/) || [])[1];
    if (!nid) err(`${d.id} 的「节点」不以两位编号开头：${nodeField}`);
    else if (!nodeIds.has(nid)) err(`${d.id} 的节点 ${nid} 不在注册表里`);
    const idm = d.id.match(/^D-(\d{2})-\d{2}$/);
    if (idm && idm[1] !== nid) err(`${d.id} 编号节点 ${idm[1]} 与「节点」${nid} 不一致`);
  }

  if (!status) err(`${d.id} 缺少「状态」`);
  else if (!['生效', '待拍板', '已被取代', '废弃'].includes(status)) err(`${d.id} 状态非法：${status}`);

  if (!date) err(`${d.id} 缺少「日期」`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) warn(`${d.id} 日期格式应为 YYYY-MM-DD：${date}`);

  if (!d.fields['理由']) warn(`${d.id} 缺少「理由」`);
  if (status === '已被取代' && !d.fields['取代者']) warn(`${d.id} 已被取代但没有「取代者」`);

  if (d.fields['影响']) {
    for (const part of d.fields['影响'].split(/[,，\s]+/)) {
      const nid = (part.match(/^(\d{2})/) || [])[1];
      if (nid && !nodeIds.has(nid)) err(`${d.id} 的「影响」节点 ${nid} 不在注册表里`);
    }
  }
}

const allDecIds = new Set(decs.map(d => d.id));
for (const d of decs) {
  const succ = d.fields['取代者'];
  if (succ && !allDecIds.has(succ)) err(`${d.id} 的「取代者」${succ} 不存在`);
}

for (const t of tasks) {
  if (!t.link) continue;
  if (allDecIds.has(t.link)) continue;
  if (/^D\d+[a-z]?$/.test(t.link)) warn(`任务引用旧编号 ${t.link}，确认台账存在（第 ${t.line} 行）`);
  else err(`任务引用了不存在的决策 ${t.link}（第 ${t.line} 行）`);
}

if (/^-\s+\[[ xX]\]/m.test(ledgerText)) err('台账里出现了任务复选框，任务应只写在看板');

const today = new Date();
for (const d of decs) {
  if (d.fields['状态'] !== '待拍板' || !d.fields['日期']) continue;
  const dt = new Date(d.fields['日期'] + 'T00:00:00');
  if (!isNaN(dt) && (today - dt) / 86400000 > 30) warn(`${d.id} 待拍板超过 30 天（${d.fields['日期']}）`);
}

info.push(`节点 ${nodes.length} · 任务 ${tasks.length}（完成 ${tasks.filter(t => t.done).length}）· 决策 ${decs.length}（待拍板 ${decs.filter(d => d.fields['状态'] === '待拍板').length}）`);

finish();

function finish() {
  const payload = { dir, board: boardFile, ledger: ledgerFile, errors, warnings, info };
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`\n📁 ${dir}`);
    console.log(`   ${boardFile || '(缺少进度看板)'}  ·  ${ledgerFile || '(缺少决策台账)'}`);
    for (const i of info) console.log(`   ${i}`);
    if (errors.length) {
      console.log(`\n✖ ${errors.length} error`);
      for (const e of errors) console.log(`   - ${e}`);
    }
    if (warnings.length) {
      console.log(`\n⚠ ${warnings.length} warning`);
      for (const w of warnings) console.log(`   - ${w}`);
    }
    if (!errors.length && !warnings.length) console.log('\n✔ lint passed');
  }
  process.exit(errors.length ? 1 : 0);
}
