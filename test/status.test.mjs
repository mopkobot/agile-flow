import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshState } from '../src/state.mjs';
import { hashPassphrase } from '../src/auth.mjs';

test('status reports debt allocation, audits, identity expiry, and harness gaps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-status-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  await mkdir(join(dir, 'docs/agile'), { recursive: true });
  const state = freshState('brownfield');
  state.debtAllocation = { percent: 25, setBy: 'human', at: 'x' };
  state.audits = { G3: { verdict: 'pass', checked: 3, sprint: 1, at: 'x' } };
  state.identity = { po: { ...hashPassphrase('token-abcdefgh'), expiresAt: '2030-01-01T00:00:00.000Z' } };
  state.humanAuth = hashPassphrase('test-passphrase');
  await writeFile(join(dir, 'docs/agile/state.json'), JSON.stringify(state));

  const { spawnSync } = await import('node:child_process');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const out = spawnSync(process.execPath, [bin, 'status'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(out, /debt allocation: 25%/);
  assert.match(out, /audit G3 pass/);
  assert.match(out, /identity po expires 2030-01-01/);
  assert.match(out, /harness gaps:/);
});
