import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { ROLE_SCOPE } from '../src/boundary.mjs';
import { seededRepo } from './helpers.mjs';

test('next records the stage base and the role write scope', async () => {
  const repo = await seededRepo();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });

  assert.equal(await run(['next'], repo), 0);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.match(state.stageBase, /^[0-9a-f]{40}$/);
  assert.deepEqual(state.writeScope, ROLE_SCOPE['agile-flow']);
});
