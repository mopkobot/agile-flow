import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBoundary, matchesScope, ROLE_SCOPE } from '../src/boundary.mjs';

async function gitRepo() {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.name', 'test']);
  git(repo, ['config', 'user.email', 'test@local']);
  await writeFile(join(repo, 'README.md'), '# r');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'init']);
  return repo;
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

export async function commitAll(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', message]);
  return git(repo, ['rev-parse', 'HEAD']).trim();
}

test('flags an untracked file outside scope', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, 'ok.mjs'), '');
  await writeFile(join(repo, 'docs-vision.md'), '# vision');
  const out = await checkBoundary(repo, ['*.mjs'], 'HEAD');
  assert.equal(out.ok, false);
  assert.deepEqual(out.violations, ['docs-vision.md']);
});

test('ignores changes committed before stageBase', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, 'docs-vision.md'), '# vision');
  const base = await commitAll(repo, 'pre-stage');
  await writeFile(join(repo, 'ok.mjs'), '');
  const out = await checkBoundary(repo, ['*.mjs'], base);
  assert.equal(out.ok, true);
});

test('flags an ignored file outside scope', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, '.gitignore'), 'secret.txt\n');
  await writeFile(join(repo, 'secret.txt'), 'x');
  const out = await checkBoundary(repo, ['*.mjs'], 'HEAD');
  assert.ok(out.violations.includes('secret.txt'));
});

test('refuses to check without a stage base', async () => {
  const repo = await gitRepo();
  const out = await checkBoundary(repo, ['*.mjs'], null);
  assert.equal(out.ok, false);
  assert.match(out.reason, /stage base/);
});

test('matchesScope handles nested globs', () => {
  assert.equal(matchesScope('docs/agile/vision.md', ['docs/agile/**']), true);
  assert.equal(matchesScope('docs/agile/vision.md', ['docs/agile/*.md']), true);
  assert.equal(matchesScope('src/app/main.ts', ['src/**']), true);
  assert.equal(matchesScope('src/app/main.ts', ['test/**']), false);
});

test('every role has a declared write scope', () => {
  for (const role of ['agile-flow', 'agile-po', 'agile-ba', 'agile-ux', 'agile-architect', 'agile-tech-lead', 'agile-dev', 'agile-qa', 'agile-sre']) {
    assert.ok(Array.isArray(ROLE_SCOPE[role]) && ROLE_SCOPE[role].length > 0, role);
  }
});
