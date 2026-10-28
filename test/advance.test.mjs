import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { seededRepo } from './helpers.mjs';

test('advance moves to the next phase and clears the stage base', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['advance'], repo), 0);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.phase, 'discovery');
  assert.equal(state.stageBase, null);
});

test('advance refuses while the phase gate has not passed', async () => {
  const repo = await seededRepo();
  await run(['advance'], repo);
  const statePath = join(repo, 'docs/agile/state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.phase = 'discovery';
  const { writeFile } = await import('node:fs/promises');
  await writeFile(statePath, JSON.stringify(state));
  assert.equal(await run(['advance'], repo), 1);
});
