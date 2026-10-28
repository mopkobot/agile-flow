import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { checkBoundary } from '../src/boundary.mjs';
import { signAs } from './helpers.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

async function flowRepo() {
  const repo = await mkdtemp(join(tmpdir(), 'af-hard-'));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.name', 'test']);
  git(repo, ['config', 'user.email', 'test@local']);
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'init']);
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 0);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'flow']);
  return repo;
}

test('sign rejects a gate name that is not a real gate', async () => {
  const repo = await flowRepo();
  const code = await run(['sign', '../../escape', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo);
  assert.equal(code, 1);
});

test('sign rejects evidence outside the artifact root', async () => {
  const repo = await flowRepo();
  await writeFile(join(repo, 'README.md'), '# readme');
  assert.equal(await run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'README.md'], repo), 1);
});

test('waive requires a concrete requirement and rejects the blanket "gate"', async () => {
  const repo = await flowRepo();
  assert.equal(await run(['waive', 'G0', '--reason', 'r', '--expires', '2099-01-01', '--approver', 'human'], repo), 1);
  assert.equal(await run(['waive', 'G0', '--requirement', 'gate', '--reason', 'r', '--expires', '2099-01-01', '--approver', 'human'], repo), 1);
});

test('check refuses a gate the flow has not reached', async () => {
  const repo = await flowRepo();
  assert.equal(await run(['next'], repo), 0);
  assert.equal(await run(['check', 'G2'], repo), 1);
});

test('advance refuses when the recorded gate pass no longer verifies', async () => {
  const repo = await flowRepo();
  await run(['next'], repo);
  await run(['advance'], repo);
  await run(['next'], repo);
  const base = join(repo, 'docs/agile');
  await writeFile(join(base, 'vision.md'), '# Vision\n\n## Vision\nv\n\n## Success metrics\nm\n');
  await writeFile(join(base, 'personas.md'), '# Personas\n\n## Personas\np\n');
  await writeFile(join(base, 'success-metrics.md'), '# Metrics\n\n## Metrics\nm\n');
  await writeFile(join(base, 'backlog.md'), '# Backlog\n\n## Backlog\nb\n');
  await signAs(repo, 'G0', 'po', 'docs/agile/vision.md');
  await run(['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'approved by operator'], repo);
  assert.equal(await run(['check', 'G0'], repo), 0);

  await writeFile(join(base, 'vision.md'), '# Vision\n');
  assert.equal(await run(['advance'], repo), 1);
});

test('advance at retro starts the next sprint at shaping', async () => {
  const repo = await flowRepo();
  const statePath = join(repo, 'docs/agile/state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.phase = 'retro';
  for (const gate of Object.keys(state.gates)) state.gates[gate] = { status: 'pass', at: 'x' };
  await writeFile(statePath, JSON.stringify(state));
  await mkdir(join(repo, 'docs/agile/retro'), { recursive: true });
  await writeFile(
    join(repo, 'docs/agile/retro/retro-01.md'),
    '# Retro\n\n## Actions\n\n| action | type | target | owner | due |\n|---|---|---|---|---|\n| tighten review | process | agile-tech-lead | tech-lead | sprint 02 |\n',
  );
  assert.equal(await run(['advance'], repo), 0);
  const next = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(next.phase, 'shaping');
  assert.equal(next.sprint, 2);
});

test('boundary fails loudly when the stage base is not a real commit', async () => {
  const repo = await flowRepo();
  const out = await checkBoundary(repo, ['docs/**'], 'not-a-sha');
  assert.equal(out.ok, false);
  assert.match(out.reason, /cannot resolve stage base/);
});

test('boundary ignores ignored files older than the stage', async () => {
  const repo = await flowRepo();
  await writeFile(join(repo, '.gitignore'), 'secret.txt\n');
  await writeFile(join(repo, 'secret.txt'), 'old');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'ignored fixture']);
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  await new Promise((r) => setTimeout(r, 1100));
  await writeFile(join(repo, 'fresh.mjs'), '');
  const out = await checkBoundary(repo, ['fresh.mjs'], base, ['secret.txt']);
  assert.equal(out.ok, true, JSON.stringify(out));
});
