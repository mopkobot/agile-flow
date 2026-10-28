import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { seededRepo } from './helpers.mjs';

async function repoWithCommit() {
  const repo = await seededRepo();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });
  return repo;
}

test('next keeps the stage base while the role is unchanged', async () => {
  const repo = await repoWithCommit();
  await run(['next'], repo);
  const first = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8')).stageBase;
  await run(['next'], repo);
  const second = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8')).stageBase;
  assert.equal(first, second);
});

test('next resets the stage base when the active role changes', async () => {
  const repo = await repoWithCommit();
  await run(['next'], repo);
  const statePath = join(repo, 'docs/agile/state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));

  const gate = state.phase;
  state.gates.G0.status = 'pass';
  state.phase = 'discovery';
  state.activeRole = 'agile-flow';
  await writeFile(statePath, JSON.stringify(state));
  await writeFile(join(repo, 'new.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'phase work'], { cwd: repo });

  await run(['next'], repo);
  const after = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(after.activeRole, 'agile-po');
  assert.notEqual(after.stageBase, state.stageBase);
});
