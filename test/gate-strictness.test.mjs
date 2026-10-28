import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GATE_DEFS, runChecks, validateArtifacts, validateTddEvidence } from '../src/gates.mjs';

async function artifactRepo(files) {
  const repo = await mkdtemp(join(tmpdir(), 'af-strict-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  for (const [rel, body] of Object.entries(files)) {
    const path = join(repo, 'docs/agile', rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  return repo;
}

test('G3 requires TDD logs and a build review', () => {
  const paths = GATE_DEFS.G3.artifacts.map((a) => a.path);
  assert.ok(paths.includes('build/*/red.log'));
  assert.ok(paths.includes('build/*/green.log'));
  assert.ok(paths.includes('build/*/review.md'));
});

test('artifact validation rejects a placeholder section body', async () => {
  const repo = await artifactRepo({ 'vision.md': '# Vision\n\n## Vision\nTODO\n\n## Success metrics\nm\n' });
  const failures = await validateArtifacts(repo, GATE_DEFS.G0.artifacts.filter((a) => a.path === 'vision.md'));
  assert.ok(failures.some((f) => /placeholder/i.test(f)), failures.join('\n'));
});

test('artifact validation rejects an empty section body', async () => {
  const repo = await artifactRepo({ 'vision.md': '# Vision\n\n## Vision\n\n## Success metrics\nm\n' });
  const failures = await validateArtifacts(repo, [GATE_DEFS.G0.artifacts[0]]);
  assert.ok(failures.some((f) => /empty section/i.test(f)), failures.join('\n'));
});

test('TDD evidence rejects a red log with zero failures', async () => {
  const repo = await artifactRepo({
    'build/S-001/red.log': '$ node --test\n# fail 0\n',
    'build/S-001/green.log': '$ node --test\n# fail 0\n',
    'build/S-001/review.md': '# Review\n\n## Verdict\npass\n',
  });
  const failures = await validateTddEvidence(repo);
  assert.ok(failures.some((f) => /red\.log/.test(f)), failures.join('\n'));
});

test('TDD evidence rejects a review without a pass verdict', async () => {
  const repo = await artifactRepo({
    'build/S-001/red.log': '$ node --test\n# fail 2\n',
    'build/S-001/green.log': '$ node --test\n# fail 0\n',
    'build/S-001/review.md': '# Review\n\n## Verdict\nfail\n',
  });
  const failures = await validateTddEvidence(repo);
  assert.ok(failures.some((f) => /verdict/.test(f)), failures.join('\n'));
});

test('coverage below 80 percent fails the check', async () => {
  const repo = await artifactRepo({});
  const out = await runChecks(repo, { coverage: `echo "all files | 55.00 | 90.00 |"`, test: 'true', lint: 'true', build: 'true', secretScan: 'true' }, ['coverage']);
  assert.equal(out.ok, false);
  assert.match(out.results[0].detail, /coverage 55/);
});

test('coverage at or above 80 percent passes', async () => {
  const repo = await artifactRepo({});
  const out = await runChecks(repo, { coverage: `echo "all files | 84.00 | 90.00 |"` }, ['coverage']);
  assert.equal(out.ok, true, JSON.stringify(out.results));
});

test('pass-with-risk needs a waiver that names the risk or the role', async () => {
  const { validateReviews, recordReview } = await import('../src/reviews.mjs');
  const repo = await artifactRepo({ 'vision.md': '# Vision\n\n## Vision\nv\n' });
  await recordReview(repo, { gate: 'G0', role: 'po', verdict: 'pass-with-risk', evidence: ['docs/agile/vision.md'] });
  const vague = await validateReviews(repo, 'G0', ['po'], {}, [{ gate: 'G0', requirement: 'unrelated.md' }]);
  assert.equal(vague.ok, false);
  const specific = await validateReviews(repo, 'G0', ['po'], {}, [{ gate: 'G0', requirement: 'risk: po' }]);
  assert.equal(specific.ok, true, specific.failures.join('\n'));
});

test('a human sign-off must carry a resolution note', async () => {
  const { validateReviews, recordReview } = await import('../src/reviews.mjs');
  const repo = await artifactRepo({ 'vision.md': '# Vision\n\n## Vision\nv\n' });
  await recordReview(repo, { gate: 'G0', role: 'human', verdict: 'pass', evidence: ['docs/agile/vision.md'] });
  const out = await validateReviews(repo, 'G0', ['human'], {});
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /note/);
});

test('G1 requires a threat model', async () => {
  const paths = GATE_DEFS.G1.artifacts.map((a) => a.path);
  assert.ok(paths.includes('architecture/threat-model.md'));
  const repo = await artifactRepo({
    'architecture/threat-model.md': '# Threat model\n\n## Assets\nusers\n\n## Trust boundaries\nedge\n\n## Threats\n- spoofing: control = session tokens\n',
  });
  const failures = await validateArtifacts(repo, GATE_DEFS.G1.artifacts.filter((a) => a.path === 'architecture/threat-model.md'));
  assert.deepEqual(failures, []);
});
