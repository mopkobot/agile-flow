import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readReviews, recordReview, validateReviews } from '../src/reviews.mjs';
import { run } from '../src/cli.mjs';
import { seededRepo } from './helpers.mjs';

test('records a review and reads it back', async () => {
  const repo = await seededRepo();
  await mkdir(join(repo, 'docs/agile/operations'), { recursive: true });
  await writeFile(join(repo, 'docs/agile/operations/slos.md'), '# SLOs');
  const path = await recordReview(repo, {
    gate: 'G3',
    role: 'sre',
    verdict: 'pass',
    evidence: ['docs/agile/operations/slos.md'],
  });
  assert.match(path, /reviews\/G3-sre\.yaml$/);
  const records = await readReviews(repo, 'G3');
  assert.equal(records.length, 1);
  assert.equal(records[0].role, 'sre');
  assert.deepEqual(records[0].evidence, ['docs/agile/operations/slos.md']);
});

test('rejects evidence that does not exist', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['sign', 'G3', '--role', 'sre', '--verdict', 'pass', '--evidence', 'nope.md'], repo), 1);
});

test('rejects an unknown role', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['sign', 'G3', '--role', 'intern', '--verdict', 'pass', '--evidence', 'a.md'], repo), 1);
});

test('rejects a role signing its own artifact', async () => {
  const repo = await seededRepo();
  await mkdir(join(repo, 'docs/agile/architecture'), { recursive: true });
  await writeFile(join(repo, 'docs/agile/architecture/system.md'), '# System');
  await recordReview(repo, {
    gate: 'G1',
    role: 'architect',
    verdict: 'pass',
    evidence: ['docs/agile/architecture/system.md'],
  });
  const out = await validateReviews(repo, 'G1', ['architect'], {
    'docs/agile/architecture/system.md': 'architect',
  });
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /self-approval/);
});

test('fails when a required role has no record', async () => {
  const repo = await seededRepo();
  const out = await validateReviews(repo, 'G3', ['sre'], {});
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /missing sign-off: sre/);
});
