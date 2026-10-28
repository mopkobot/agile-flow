import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nextAction, PHASES, PHASE_ROLE } from '../src/phases.mjs';
import { run } from '../src/cli.mjs';
import { baseState, pick, seededRepo } from './helpers.mjs';

test('next maps phase to role and blocks on escalation', () => {
  const s = baseState();
  assert.deepEqual(pick(nextAction(s)), { phase: 'intake', role: 'agile-flow', gate: null, blocked: null });
  s.escalation = { reason: 'gate-failed-twice', question: 'q', blockedPhase: 'build', at: 'x' };
  assert.equal(nextAction(s).blocked, 'escalation: gate-failed-twice');
});

test('every phase has a role and the gate map covers the spec order', () => {
  assert.equal(PHASES.length, 11);
  for (const phase of PHASES) assert.ok(PHASE_ROLE[phase], phase);
  assert.equal(nextAction({ ...baseState(), phase: 'architecture' }).gate, 'G1');
});

test('resume refuses when state.json is corrupt', async () => {
  const repo = await seededRepo();
  await writeFile(join(repo, 'docs/agile/state.json'), '{ broken');
  assert.equal(await run(['resume', '--note', 'fixed'], repo), 1);
});

test('resume clears an escalation only with a note', async () => {
  const repo = await seededRepo();
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  state.escalation = { reason: 'gate-failed-twice', question: 'q', blockedPhase: 'build', at: 'x' };
  await writeFile(join(repo, 'docs/agile/state.json'), JSON.stringify(state));
  assert.equal(await run(['resume', '--note', ''], repo), 1);
  assert.equal(await run(['resume', '--note', 'operator supplied the missing repo'], repo), 0);
});
