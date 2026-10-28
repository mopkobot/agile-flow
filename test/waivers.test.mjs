import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { activeWaivers, addWaiver, waiverCovers, WaiverError } from '../src/waivers.mjs';
import { loadState } from '../src/state.mjs';
import { run } from '../src/cli.mjs';
import { seededRepo } from './helpers.mjs';

test('expired waiver no longer opens the gate', async () => {
  const repo = await seededRepo();
  await addWaiver(repo, { gate: 'G3', requirement: 'load', reason: 'r', expires: '2020-01-01', approver: 'human' });
  assert.equal(activeWaivers(await loadState(repo), new Date('2026-10-27')).length, 0);
  await addWaiver(repo, { gate: 'G3', requirement: 'load', reason: 'r', expires: '2027-01-01', approver: 'human' });
  assert.equal(activeWaivers(await loadState(repo), new Date('2026-10-27')).length, 1);
});

test('rejects a non-human approver', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['waive', 'G3', '--reason', 'r', '--expires', '2027-01-01', '--approver', 'agent'], repo), 1);
  await assert.rejects(
    () => addWaiver(repo, { gate: 'G3', reason: 'r', expires: '2027-01-01', approver: 'agent' }),
    WaiverError,
  );
});

test('rejects a malformed expiry date', async () => {
  const repo = await seededRepo();
  await assert.rejects(
    () => addWaiver(repo, { gate: 'G3', reason: 'r', expires: 'next year', approver: 'human' }),
    WaiverError,
  );
});

test('writes a human-readable waiver record', async () => {
  const repo = await seededRepo();
  await addWaiver(repo, { gate: 'G3', requirement: 'load', reason: 'no load environment', expires: '2027-01-01', approver: 'human' });
  const md = await readFile(join(repo, 'docs/agile/waivers/G3.md'), 'utf8');
  assert.match(md, /no load environment/);
  assert.match(md, /expires: 2027-01-01/);
});

test('an active waiver suppresses the matching gate failure', async () => {
  const repo = await seededRepo();
  await addWaiver(repo, { gate: 'G0', requirement: 'vision.md', reason: 'draft approved offline', expires: '2027-01-01', approver: 'human' });
  const state = await loadState(repo);
  assert.equal(activeWaivers(state, new Date('2026-10-27'))[0].requirement, 'vision.md');
});

test('waiverCovers matches only the named requirement', () => {
  const waivers = [{ gate: 'G0', requirement: 'vision.md' }];
  assert.equal(waiverCovers(waivers, 'G0', 'missing artifact: docs/agile/vision.md'), true);
  assert.equal(waiverCovers(waivers, 'G0', 'missing artifact: docs/agile/personas.md'), false);
  assert.equal(waiverCovers(waivers, 'G1', 'missing artifact: docs/agile/vision.md'), false);
});
