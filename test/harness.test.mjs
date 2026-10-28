import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectHarness } from '../src/harness.mjs';
import { run } from '../src/cli.mjs';

async function repo(files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'af-harness-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  return dir;
}

test('an empty repo reports every harness gap', async () => {
  const dir = await repo();
  const out = detectHarness(dir);
  assert.ok(out.missing.includes('agent instructions'));
  assert.ok(out.missing.includes('test command'));
  assert.ok(out.missing.includes('CI pipeline'));
  assert.ok(out.missing.includes('architecture context'));
  assert.ok(out.missing.includes('reliability signals'));
});

test('a repo with the full harness reports no gaps', async () => {
  const dir = await repo({
    'AGENTS.md': '# rules',
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    '.github/workflows/ci.yml': 'name: ci',
    'docs/architecture.md': '# architecture',
    'docs/product.md': '# product',
    'src/server.mjs': 'export const x = 1;',
    'ops/alerts.yaml': 'alert: x',
  });
  const out = detectHarness(dir);
  assert.deepEqual(out.missing, []);
  assert.ok(out.present.length >= 5);
});

test('harness command exits 1 on gaps and 0 when complete', async () => {
  const dir = await repo();
  assert.equal(await run(['harness'], dir), 1);

  await writeFile(join(dir, 'AGENTS.md'), '# rules');
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  await mkdir(join(dir, '.github', 'workflows'), { recursive: true });
  await writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci');
  await mkdir(join(dir, 'docs'), { recursive: true });
  await writeFile(join(dir, 'docs', 'architecture.md'), '# architecture');
  await writeFile(join(dir, 'docs', 'product.md'), '# product');
  await mkdir(join(dir, 'ops'), { recursive: true });
  await writeFile(join(dir, 'ops', 'alerts.yaml'), 'alert: x');
  assert.equal(await run(['harness'], dir), 0);
});
