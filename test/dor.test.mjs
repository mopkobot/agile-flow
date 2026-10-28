import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { loadState } from '../src/state.mjs';
import { signAs } from './helpers.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

const STORY = `# S-001 Greet

## Story
As a visitor, I want a greeting, so that it feels personal.

## Acceptance criteria
- Given a name, When I call it, Then I am greeted.

## Non-goals
- Persistence.

## Test plan
- Unit: greeting.

## Wireframe
- docs/agile/ux/wireframes/S-001.html

## NFRs
- Latency under 100 ms.

## Open questions
- None.

## Slice
size: small
priority: 1
dependencies: none
`;

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'af-dor-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  await run(['init', '--mode', 'greenfield', '--repo', dir], dir);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  await run(['next'], dir);
  await run(['advance'], dir);
  return dir;
}

async function put(dir, rel, body) {
  const path = join(dir, 'docs/agile', rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

async function signDor(dir, id, roles = ['ba', 'ux', 'sre', 'tech-lead']) {
  for (const role of roles) {
    const code = await signAs(dir, `DoR-${id}`, role, `docs/agile/stories/${id}.md`);
    assert.equal(code, 0, `${role} sign failed`);
  }
}

test('a story without shaping sign-offs is not ready', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY);
  await put(dir, 'ux/wireframes/S-001.html', '<!doctype html><p>hi</p>');
  assert.equal(await run(['check', 'DoR-S-001'], dir), 1);
});

test('a story with all four shaping sign-offs and a wireframe is ready', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY);
  await put(dir, 'ux/wireframes/S-001.html', '<!doctype html><p>hi</p>');
  await signDor(dir, 'S-001');
  assert.equal(await run(['check', 'DoR-S-001'], dir), 0);
  const state = await loadState(dir);
  assert.equal(state.stories['S-001'].dor, 'pass');
});

test('an open blocking question keeps a story unready', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY.replace('- None.', '- Which currency? — owner: po, status: open'));
  await put(dir, 'ux/wireframes/S-001.html', '<!doctype html><p>hi</p>');
  await signDor(dir, 'S-001');
  assert.equal(await run(['check', 'DoR-S-001'], dir), 1);
});

test('a missing wireframe keeps a story unready', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY);
  await signDor(dir, 'S-001');
  assert.equal(await run(['check', 'DoR-S-001'], dir), 1);
});

test('a story without a priority is not ready', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY.replace('priority: 1', 'priority:'));
  await put(dir, 'ux/wireframes/S-001.html', '<!doctype html><p>hi</p>');
  await signDor(dir, 'S-001');
  assert.equal(await run(['check', 'DoR-S-001'], dir), 1);
});

test('an unknown story id fails cleanly', async () => {
  const dir = await repo();
  assert.equal(await run(['check', 'DoR-S-999'], dir), 1);
});

test('status reports per-story readiness', async () => {
  const dir = await repo();
  await put(dir, 'stories/S-001.md', STORY);
  await put(dir, 'ux/wireframes/S-001.html', '<!doctype html><p>hi</p>');
  await signDor(dir, 'S-001');
  await run(['check', 'DoR-S-001'], dir);

  const { spawnSync } = await import('node:child_process');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const out = spawnSync(process.execPath, [bin, 'status'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(out, /S-001 dor pass/);
});

test('a built story whose DoR never passed blocks release', async () => {
  const { validateStoryLinkage } = await import('../src/gates.mjs');
  const dir = await repo();
  await put(dir, 'build/S-001/plan.md', '# plan');
  const state = await loadState(dir);
  const failures = await validateStoryLinkage(dir, state);
  assert.ok(failures.some((f) => /S-001/.test(f) && /DoR/.test(f)), failures.join('\n'));
});
