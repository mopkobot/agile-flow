import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';

test('init creates state and status prints the phase', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 0);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.phase, 'intake');
  assert.equal(state.gates.G0.status, 'locked');
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 2);
});

test('status prints phase and gate states', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await run(['init', '--mode', 'brownfield', '--repo', repo], repo);
  const out = await captureStatus(repo);
  assert.match(out, /phase: intake/);
  assert.match(out, /mode: brownfield/);
  assert.match(out, /G0 locked/);
});

async function captureStatus(repo) {
  const { spawnSync } = await import('node:child_process');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const res = spawnSync(process.execPath, [bin, 'status'], { cwd: repo, encoding: 'utf8' });
  return res.stdout + res.stderr;
}
