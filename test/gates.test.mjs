import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkGate } from '../src/gates.mjs';
import { loadState } from '../src/state.mjs';
import { run } from '../src/cli.mjs';
import { seededRepo, signAs } from './helpers.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

async function flowRepo({ profileCommand = 'true', stack = true } = {}) {
  const repo = await seededRepo();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  await writeFile(join(repo, 'README.md'), '# r');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });
  const state = await loadState(repo);
  state.stageBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  state.writeScope = ['docs/agile/**'];
  await writeFile(join(repo, 'docs/agile/state.json'), JSON.stringify(state));
  if (stack) {
    const profile = [
      '# Stack Profile',
      '',
      '| field | value |',
      '|---|---|',
      '| language | node |',
      '| manifest | package.json |',
      `| test | ${profileCommand} |`,
      '| coverage | true |',
      '| lint | true |',
      '| build | true |',
      '| secretScan | true |',
      '| a11y | not applicable |',
      '| load | true |',
      '',
    ].join('\n');
    await writeFile(join(repo, 'docs/agile/stack-profile.md'), profile);
  }
  return repo;
}

async function writeArtifact(repo, rel, body) {
  const path = join(repo, 'docs/agile', rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

async function completeG0(repo) {
  await writeArtifact(repo, 'vision.md', '# Vision\n\n## Vision\nv\n\n## Success metrics\nm\n');
  await writeArtifact(repo, 'personas.md', '# Personas\n\n## Personas\np\n');
  await writeArtifact(repo, 'success-metrics.md', '# Metrics\n\n## Metrics\nm\n');
  await writeArtifact(repo, 'backlog.md', '# Backlog\n\n## Backlog\nb\n');
  assert.equal(await signAs(repo, 'G0', 'po', 'docs/agile/vision.md'), 0);
  assert.equal(await run(['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'approved by operator'], repo), 0);
}

test('G0 fails on a missing artifact and passes when complete', async () => {
  const repo = await flowRepo();
  const bad = await checkGate(repo, 'G0');
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.some((f) => f.includes('vision.md')));

  await completeG0(repo);
  const good = await checkGate(repo, 'G0');
  assert.equal(good.ok, true, good.failures.join('\n'));
});

test('a missing stack command fails the gate instead of skipping', async () => {
  const repo = await flowRepo({ profileCommand: 'definitely-not-a-command' });
  const out = await checkGate(repo, 'G3');
  assert.equal(out.ok, false);
  assert.ok(out.failures.some((f) => f.includes('definitely-not-a-command')), out.failures.join('\n'));
});

test('second failure writes an escalation', async () => {
  const repo = await flowRepo();
  assert.equal(await run(['check', 'G0'], repo), 1);
  assert.equal(await run(['check', 'G0'], repo), 1);
  assert.equal((await loadState(repo)).escalation.reason, 'gate-failed-twice');
});

test('a passing gate is recorded and retries reset', async () => {
  const repo = await flowRepo();
  await checkGate(repo, 'G0');
  await completeG0(repo);
  const good = await checkGate(repo, 'G0');
  assert.equal(good.ok, true);
  const state = await loadState(repo);
  assert.equal(state.gates.G0.status, 'pass');
  assert.equal(state.gateRetries.G0, 0);
});
