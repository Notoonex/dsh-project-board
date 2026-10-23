#!/usr/bin/env node
/**
 * 旧看板扫描器（只读）
 * usage: node scan-legacy.mjs <project-dir> [--json]
 *
 * 输出：章节 → 任务数 → 建议节点；决策 ID → 标题 → 建议节点。
 * 用于迁移前生成 mapping 草稿，不修改任何文件。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirArg = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');

if (!dirArg) {
  console.error('usage: node scan-legacy.mjs <project-dir> [--json]');
  process.exit(2);
}

const dir = path.resolve(dirArg);
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`not a directory: ${dir}`);
  process.exit(2);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
const board = files.find(f => f.endsWith('进度看板.md')) || files.find(f => f.endsWith('项目看板.md'));
const ledger = files.find(f => f.endsWith(' 决策台账.md')) || files.find(f => f.endsWith('决策台账.md'));

const RULES = [
  [/待办|焦点|攻坚|下一步|待决策|问题清单/, 'mixed'],
  [/首页|首屏|导航|视觉|landing/i, '20'],
  [/学习|演练|课堂|课程页|舞台|抽屉|交互|手势|评分|音频|录音/i, '30'],
  [/登录|注册|认证|账户|oauth|会话|找回|密码|令牌/i, '40'],
  [/个人中心|我的|资料|额度|设置/i, '50'],
  [/内容|素材|课程库|校对|版权|剪辑|帧|字幕/i, '60'],
  [/支付|商业化|定价|会员|订阅|退款|广告|权益|订单|币种/i, '70'],
  [/后台|admin|管理端|管理后台|治理视图/i, '80'],
  [/部署|运维|架构|技术|安全|数据库|ci|监控|seo|缓存|备份|域名|证书|构建|服务器/i, '10'],
  [/立项|调研|文档|规范|治理|评审|验证|复盘/i, '00'],
  [/归档|历史|废弃/i, '90']
];

function suggest(text) {
  for (const [re, id] of RULES) if (re.test(text)) return id;
  return '?';
}

const report = { dir, board: board || null, ledger: ledger || null, sections: [], decisions: [], mapping: {} };

if (board) {
  const text = fs.readFileSync(path.join(dir, board), 'utf8');
  const lines = text.split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      cur = { title: h[1].replace(/\s*(完成|已上线|部分完成|未开始)\s*$/, '').trim(), tasks: 0, done: 0, samples: [] };
      report.sections.push(cur);
      continue;
    }
    const t = line.match(/^-\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (t && cur) {
      cur.tasks++;
      if (t[1].toLowerCase() === 'x') cur.done++;
      if (cur.samples.length < 3) cur.samples.push(t[2].replace(/~~/g, '').slice(0, 40));
    }
  }
  for (const s of report.sections) {
    s.suggest = suggest(s.title);
    report.mapping[s.title] = s.suggest;
  }
}

if (ledger) {
  const text = fs.readFileSync(path.join(dir, ledger), 'utf8');
  const seen = new Set();
  const rowRe = /^\|\s*(D\d+[a-z]?|D-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|/gm;
  let m;
  while ((m = rowRe.exec(text))) {
    if (seen.has(m[1])) continue;
    const t = m[2].replace(/\*\*/g, '').trim();
    if (/^D\d+[a-z]?$/.test(t)) continue;
    seen.add(m[1]);
    report.decisions.push({ id: m[1], title: t.slice(0, 60), suggest: suggest(t) });
  }
  const headRe = /^###\s+(D\d+[a-z]?|D-\d{2}-\d{2})\s+(.+?)\s*$/gm;
  while ((m = headRe.exec(text))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    report.decisions.push({ id: m[1], title: m[2].slice(0, 60), suggest: suggest(m[2]) });
  }
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n📁 ${dir}`);
  console.log(`   ${board || '(无看板)'}  ·  ${ledger || '(无台账)'}`);

  console.log('\n── 章节 → 建议节点 ──');
  for (const s of report.sections) {
    console.log(`  ${s.suggest.padEnd(2)}  ${s.title}  (${s.done}/${s.tasks}${s.samples.length ? ' · ' + s.samples[0] : ''})`);
  }

  console.log('\n── 决策 → 建议节点 ──');
  for (const d of report.decisions) {
    console.log(`  ${d.suggest.padEnd(2)}  ${d.id}  ${d.title}`);
  }

  console.log('\n── mapping 草稿（需人工修正）──');
  console.log(JSON.stringify(report.mapping, null, 2));
}
