import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { loadState } from '../src/state.mjs';
import {
  validateNfrMeasurements,
  validateQaEvidence,
  validateReviewClaims,
} from '../src/gates.mjs';
import { listClaims, recordAudit, validateAudit } from '../src/audit.mjs';
import { freshState } from '../src/state.mjs';

async function repo(files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'af-cite-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, 'docs/agile', rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'src', 'app.mjs'), 'line1\nline2\nline3\n');
  await mkdir(join(dir, 'docs/agile'), { recursive: true });
  await writeFile(join(dir, 'docs/agile/state.json'), JSON.stringify(freshState('greenfield')));
  return dir;
}

test('a failing review must cite a real path and line', async () => {
  const dir = await repo({ 'build/S-001/review.md': '# R\n\n## Verdict\nfail\n\n## Findings\n- something is wrong\n' });
  const failures = await validateReviewClaims(dir, 'build/S-001/review.md');
  assert.ok(failures.some((f) => /citation/.test(f)), failures.join('\n'));
});

test('a citation to a missing file or a line past EOF fails', async () => {
  const dir = await repo({ 'build/S-001/review.md': '# R\n\n## Verdict\nfail\n\n## Findings\n- src/nope.mjs:4 missing\n' });
  const failures = await validateReviewClaims(dir, 'build/S-001/review.md');
  assert.ok(failures.some((f) => /does not exist/.test(f)), failures.join('\n'));

  await writeFile(join(dir, 'docs/agile/build/S-001/review.md'), '# R\n\n## Verdict\nfail\n\n## Findings\n- src/app.mjs:99 past end\n');
  const past = await validateReviewClaims(dir, 'build/S-001/review.md');
  assert.ok(past.some((f) => /line 99/.test(f)), past.join('\n'));
});

test('a valid review citation passes', async () => {
  const dir = await repo({ 'build/S-001/review.md': '# R\n\n## Verdict\nfail\n\n## Findings\n- src/app.mjs:2 duplicated rule. Extract.\n' });
  assert.deepEqual(await validateReviewClaims(dir, 'build/S-001/review.md'), []);
});

test('qa evidence must contain an executed command', async () => {
  const dir = await repo({ 'quality/evidence/S-001.md': '# Evidence\n\n- criterion one: passed\n' });
  const failures = await validateQaEvidence(dir, 'quality/evidence/S-001.md');
  assert.ok(failures.some((f) => /command/.test(f)), failures.join('\n'));

  await writeFile(join(dir, 'docs/agile/quality/evidence/S-001.md'), '# Evidence\n\n```\n$ node --test\n# pass 4\n```\n');
  assert.deepEqual(await validateQaEvidence(dir, 'quality/evidence/S-001.md'), []);
});

test('every NFR row must name a measurement', async () => {
  const dir = await repo({
    'architecture/nfrs.md': '# NFRs\n\n## NFRs\n| quality | target | measurement | owner |\n|---|---|---|---|\n| latency | p95 < 200ms |  | sre |\n',
  });
  const failures = await validateNfrMeasurements(dir);
  assert.ok(failures.some((f) => /measurement/.test(f)), failures.join('\n'));
});

test('audit sample lists claims and a record opens the gate', async () => {
  const dir = await repo({
    'build/S-001/review.md': '# R\n\n## Verdict\npass\n\n## Findings\n- none\n- src/app.mjs:1 tidy. Rename.\n',
    'quality/evidence/S-001.md': '# E\n\n```\n$ node --test\n# pass 4\n```\n',
  });
  const claims = await listClaims(dir, 5);
  assert.ok(claims.some((c) => c.includes('src/app.mjs:1')), claims.join('\n'));
  assert.ok(claims.some((c) => c.includes('node --test')), claims.join('\n'));

  assert.equal(await validateAudit(dir, 'G3'), false);
  await recordAudit(dir, { gate: 'G3', verdict: 'pass', checked: 2, note: 'spot-checked' });
  assert.equal(await validateAudit(dir, 'G3'), true);
  const state = await loadState(dir);
  assert.equal(state.audits.G3.checked, 2);
});

test('audit requires an interactive check count above zero', async () => {
  const dir = await repo();
  assert.equal(await run(['audit', 'record', '--gate', 'G3', '--verdict', 'pass', '--checked', '0', '--note', 'x'], dir), 1);
});
