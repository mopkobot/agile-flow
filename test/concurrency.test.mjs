import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initFlow, loadState, saveState, StateError } from '../src/state.mjs';

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'af-lock-'));
  await initFlow(dir, 'greenfield');
  return dir;
}

test('two writers cannot clobber each other', async () => {
  const dir = await repo();
  const first = await loadState(dir);
  const second = await loadState(dir);

  first.phase = 'discovery';
  await saveState(dir, first);

  second.phase = 'build';
  await assert.rejects(() => saveState(dir, second), StateError);

  const after = await loadState(dir);
  assert.equal(after.phase, 'discovery');
  assert.equal(after.revision, 2);
});

test('every write increments the revision', async () => {
  const dir = await repo();
  const state = await loadState(dir);
  assert.equal(state.revision, 1);
  state.phase = 'discovery';
  await saveState(dir, state);
  assert.equal((await loadState(dir)).revision, 2);
});

test('concurrent phase transitions keep exactly one winner', async () => {
  const dir = await repo();
  const attempts = await Promise.all(
    ['discovery', 'shaping', 'ux', 'architecture'].map(async (phase) => {
      const state = await loadState(dir);
      state.phase = phase;
      try {
        await saveState(dir, state);
        return true;
      } catch {
        return false;
      }
    }),
  );
  assert.equal(attempts.filter(Boolean).length, 1);
});
