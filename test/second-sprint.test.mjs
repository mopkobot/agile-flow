import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

function cleanEnv() {
  const env = { ...process.env };
  return env;
}

async function copyFixture(name = 'sample-app') {
  const repo = await mkdtemp(join(tmpdir(), 'af-s2-'));
  await cp(join(import.meta.dirname, '..', 'fixtures', name), repo, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repo });
  return repo;
}

async function put(repo, rel, body) {
  const path = join(repo, 'docs/agile', rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

function commit(repo, message) {
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', message], { cwd: repo });
}

function signArgs(gate, role, evidence, extra = []) {
  return ['sign', gate, '--role', role, '--verdict', 'pass', '--evidence', evidence, ...extra];
}

test('a second sprint runs from shaping through retro', async () => {
  const repo = await copyFixture();
  const script = join(import.meta.dirname, '..', 'fixtures', 'run-flow.sh');
  execFileSync('bash', [script, repo], { cwd: repo, stdio: 'pipe', env: cleanEnv(), timeout: 300_000 });

  assert.equal(await run(['advance'], repo), 0);
  assert.equal(await run(['next'], repo), 0);

  await put(repo, 'stories/S-002.md', `# S-002 Farewell

## Story
As a visitor, I want a farewell, so that leaving is polite.

## Acceptance criteria
- Given a name, When I call /farewell, Then I am farewelled.

## Non-goals
- Persistence.

## Test plan
- Unit: farewell text.

## Wireframe
- docs/agile/ux/wireframes/S-002.html

## NFRs
- Latency under 200 ms.

## Open questions
- None.

## Slice
size: small
priority: 2
dependencies: none
`);

  for (const role of ['ba', 'sre', 'tech-lead']) {
    assert.equal(await run(signArgs('DoR-S-002', role, 'docs/agile/stories/S-002.md'), repo), 0, role);
  }
  await put(repo, 'ux/wireframes/S-002.html', '<!doctype html><p>farewell</p>');
  assert.equal(await run(['next'], repo), 0);
  assert.equal(await run(signArgs('DoR-S-002', 'ux', 'docs/agile/ux/wireframes/S-002.html'), repo), 0);
  assert.equal(await run(['check', 'DoR-S-002'], repo), 0);
  commit(repo, 'docs: shape S-002');

  for (const phase of ['ux', 'architecture', 'planning']) {
    assert.equal(await run(['advance'], repo), 0, phase);
    await run(['next'], repo);
  }

  await put(repo, 'plan/sprint-02.md', '# Sprint 02\n\n## Scope\nFarewell endpoint.\n\n## Stories\n1. S-002\n');
  assert.equal(await run(['check', 'G2'], repo), 0);
  commit(repo, 'docs: plan sprint 02');
  assert.equal(await run(['advance'], repo), 0);

  await run(['next'], repo);
  await put(repo, 'build/S-002/plan.md', '# plan\n\nFiles: src/app.mjs.\n');
  await put(repo, 'build/S-002/red.log', '$ node --test\n# fail 2\n');
  await put(repo, 'build/S-002/green.log', '$ node --test\n# fail 0\n');
  await put(repo, 'build/S-002/review.md', '# Review\n\n## Verdict\npass\n\nreviewer: reviewer-spawn\nimplementer: implementer-spawn\n\n## Findings\n- src/app.mjs:1 tidy. No findings.\n');

  commit(repo, 'feat: S-002');

  assert.equal(await run(['advance'], repo), 0, 'quality');
  await run(['next'], repo);
  await put(repo, 'quality/evidence/S-002.md', '# Evidence\n\n```\n$ npm test\n# pass 8\n```\n');
  commit(repo, 'docs: quality S-002');

  assert.equal(await run(['advance'], repo), 0, 'release');
  await run(['next'], repo);

  assert.equal(await run(['check', 'G3'], repo), 1);
  assert.equal(await run(['audit', 'record', '--gate', 'G3', '--verdict', 'pass', '--checked', '2', '--note', 'sprint 2 sample'], repo), 0);
  assert.equal(await run(['check', 'G3'], repo), 0);
  commit(repo, 'docs: release sprint 02');
  assert.equal(await run(['advance'], repo), 0);
  await run(['next'], repo);
  assert.equal(await run(['check', 'G4'], repo), 1);
  assert.equal(await run(['audit', 'record', '--gate', 'G4', '--verdict', 'pass', '--checked', '1', '--note', 'sprint 2 ops'], repo), 0);
  assert.equal(await run(['check', 'G4'], repo), 0);
  assert.equal(await run(['advance'], repo), 0);
  await run(['next'], repo);
  await put(repo, 'retro/retro-02.md', '# Retro 02\n\n## What worked\n- second sprint\n\n## Actions\n- none\n');
  commit(repo, 'docs: retro 02');

  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.sprint, 2);
  assert.equal(state.phase, 'retro');
  assert.equal(state.stories['S-001'].dod, 'pass');
  assert.equal(state.stories['S-002'].dor, 'pass');
  assert.equal(state.stories['S-002'].dod, 'pass');
});
