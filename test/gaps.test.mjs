import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { loadState } from '../src/state.mjs';
import { runChecks, validateTddEvidence } from '../src/gates.mjs';

async function repo(files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'af-gap-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, 'docs/agile', rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  return dir;
}

test('a coverage command that enforces its own threshold passes without a percentage', async () => {
  const dir = await repo();
  const out = await runChecks(dir, { coverage: 'npx c8 --check-coverage --lines 80 true' }, ['coverage']);
  assert.equal(out.ok, true, JSON.stringify(out.results));
});

test('a coverage command with no threshold and no percentage fails', async () => {
  const dir = await repo();
  const out = await runChecks(dir, { coverage: 'true' }, ['coverage']);
  assert.equal(out.ok, false);
  assert.match(out.results[0].detail, /no percentage|threshold/i);
});

test('guard records a destructive-action escalation and blocks advance', async () => {
  const dir = await repo();
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir], dir), 0);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  await run(['next'], dir);

  assert.equal(await run(['guard', 'force-push', '--question', 'This rewrites published history. Approve?'], dir), 1);
  const state = await loadState(dir);
  assert.equal(state.escalation.reason, 'destructive-action');
  assert.match(state.escalation.question, /rewrites published history/);
  assert.equal(await run(['advance'], dir), 1);
  assert.equal(await run(['resume', '--note', 'operator approved rewrite'], dir), 0);
});

test('guard rejects an unknown action', async () => {
  const dir = await repo();
  await run(['init', '--mode', 'greenfield', '--repo', dir], dir);
  assert.equal(await run(['guard', 'rm-rf', '--question', 'q'], dir), 1);
});

test('build review must name a reviewer distinct from the implementer', async () => {
  const dir = await repo({
    'build/S-001/red.log': '$ node --test\n# fail 2\n',
    'build/S-001/green.log': '$ node --test\n# fail 0\n',
    'build/S-001/review.md': '# Review\n\n## Verdict\npass\n\nreviewer: same-agent\nimplementer: same-agent\n',
  });
  const failures = await validateTddEvidence(dir);
  assert.ok(failures.some((f) => /reviewer/.test(f)), failures.join('\n'));

  await writeFile(
    join(dir, 'docs/agile/build/S-001/review.md'),
    '# Review\n\n## Verdict\npass\n\nreviewer: reviewer-spawn\nimplementer: implementer-spawn\n',
  );
  assert.deepEqual(await validateTddEvidence(dir), []);
});
