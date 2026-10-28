import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { addWaiver } from '../src/waivers.mjs';


async function repoAtDiscovery() {
  const repo = await mkdtemp(join(tmpdir(), 'af-neg-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 0);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'flow init'], { cwd: repo });
  assert.equal(await run(['next'], repo), 0);
  assert.equal(await run(['advance'], repo), 0);
  assert.equal(await run(['next'], repo), 0);
  return repo;
}

async function writeArtifact(repo, rel, body) {
  const path = join(repo, 'docs/agile', rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

async function scopeArtifacts(repo, { backlog = true } = {}) {
  await writeArtifact(repo, 'vision.md', '# Vision\n\n## Vision\nv\n\n## Success metrics\nm\n');
  await writeArtifact(repo, 'personas.md', '# Personas\n\n## Personas\np\n');
  await writeArtifact(repo, 'success-metrics.md', '# Metrics\n\n## Metrics\nm\n');
  if (backlog) await writeArtifact(repo, 'backlog.md', '# Backlog\n\n## Backlog\nb\n');
  await run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo);
  await run(['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'approved by operator'], repo);
}

test('boundary violation blocks the stage', async () => {
  const repo = await repoAtDiscovery();
  await scopeArtifacts(repo);
  await writeFile(join(repo, 'src-evil.mjs'), '// outside every scope');
  assert.equal(await run(['check', 'G0'], repo), 1);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.ok(state.gateRetries.G0 >= 1);
});

test('an active waiver opens the gate and an expired one closes it', async () => {
  const repo = await repoAtDiscovery();
  await scopeArtifacts(repo, { backlog: false });
  assert.equal(await run(['check', 'G0'], repo), 1);

  await addWaiver(repo, {
    gate: 'G0',
    requirement: 'backlog.md',
    reason: 'backlog lives in the issue tracker for this sprint',
    expires: '2099-01-01',
    approver: 'human',
  });
  assert.equal(await run(['check', 'G0'], repo), 0);

  const statePath = join(repo, 'docs/agile/state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.waivers[0].expires = '2020-01-01';
  await writeFile(statePath, JSON.stringify(state));
  assert.equal(await run(['check', 'G0'], repo), 1);
});
