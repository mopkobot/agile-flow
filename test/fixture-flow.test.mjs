import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';

async function copyFixture(name = 'sample-app') {
  const repo = await mkdtemp(join(tmpdir(), 'af-fixture-'));
  await cp(join(import.meta.dirname, '..', 'fixtures', name), repo, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repo });
  return repo;
}

function commit(repo, message) {
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', message], { cwd: repo });
}

async function writeArtifact(repo, rel, body) {
  const path = join(repo, 'docs/agile', rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

async function minimalG0(repo) {
  await writeArtifact(repo, 'vision.md', '# Vision\n\n## Vision\nServe one greeting.\n\n## Success metrics\np95 under 100 ms.\n');
  await writeArtifact(repo, 'personas.md', '# Personas\n\n## Personas\nOperator.\n');
  await writeArtifact(repo, 'success-metrics.md', '# Metrics\n\n## Metrics\np95 under 100 ms.\n');
  await writeArtifact(repo, 'backlog.md', '# Backlog\n\n## Backlog\n| rank | id | title |\n|---|---|---|\n| 1 | S-001 | greet |\n');
}

test('G0 refuses without artifacts and opens when complete', async () => {
  const repo = await copyFixture();
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 0);
  commit(repo, 'init');
  assert.equal(await run(['next'], repo), 0);
  assert.equal(await run(['check', 'G0'], repo), 1);

  assert.equal(await run(['advance'], repo), 0);
  assert.equal(await run(['next'], repo), 0);
  await minimalG0(repo);
  assert.equal(await run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo), 0);
  assert.equal(await run(['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo), 0);
  assert.equal(await run(['check', 'G0'], repo), 0);
});

test('the fixture app test suite passes', async () => {
  const repo = await copyFixture();
  execFileSync('npm', ['test'], { cwd: repo, stdio: 'ignore' });
});

test('the full flow reaches retro with every gate passed', async () => {
  const repo = await copyFixture();
  const script = join(import.meta.dirname, '..', 'fixtures', 'run-flow.sh');
  execFileSync('bash', [script, repo], { cwd: repo, stdio: 'ignore', timeout: 120_000 });
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.phase, 'retro');
  for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4']) assert.equal(state.gates[gate].status, 'pass', gate);
});

test('the brownfield flow records a legacy assessment before build', async () => {
  const repo = await copyFixture('legacy-app');
  const script = join(import.meta.dirname, '..', 'fixtures', 'run-flow.sh');
  execFileSync('bash', [script, repo, 'brownfield'], { cwd: repo, stdio: 'ignore', timeout: 120_000 });
  const assessment = await readFile(join(repo, 'docs/agile/architecture/legacy-assessment.md'), 'utf8');
  assert.match(assessment, /Duplicated rules/);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.mode, 'brownfield');
  assert.equal(state.phase, 'retro');
});
