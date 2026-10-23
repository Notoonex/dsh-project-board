import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lint = path.join(root, 'skill', 'scripts', 'lint.mjs');

const ok = spawnSync(process.execPath, [lint, path.join(root, 'examples', 'demo')], { encoding: 'utf8' });
if (ok.status !== 0) {
  console.error(ok.stdout);
  console.error(ok.stderr);
  throw new Error('valid fixture should pass lint');
}
console.log('✔ valid fixture passes');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-lint-'));
fs.writeFileSync(path.join(tmp, 'bad 进度看板.md'), '## 00 治理\n- [ ] no frontmatter\n');
fs.writeFileSync(path.join(tmp, 'bad 决策台账.md'), '### D-00-01 x\n- 节点: 99 不存在\n');

const bad = spawnSync(process.execPath, [lint, tmp], { encoding: 'utf8' });
fs.rmSync(tmp, { recursive: true, force: true });

if (bad.status === 0) {
  console.error(bad.stdout);
  throw new Error('broken fixture should fail lint');
}
console.log('✔ broken fixture fails as expected');
