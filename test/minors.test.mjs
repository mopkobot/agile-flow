import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { SECRET_SCAN } from '../src/stack.mjs';
import { runChecks } from '../src/gates.mjs';
import { validateSkill } from '../src/skills.mjs';

async function gitRepo() {
  const dir = await mkdtemp(join(tmpdir(), 'af-minor-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'README.md'), '# r');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

test('qa does not own e2e test code and says who does', async () => {
  const skill = await import('node:fs/promises').then((fs) => fs.readFile('skills/agile-qa/SKILL.md', 'utf8'));
  const owned = skill.split('owned_paths:')[1].split('must_not:')[0];
  assert.ok(!owned.includes('test/e2e'), 'qa must not own test/e2e');
  assert.match(skill, /verif/i);
  assert.equal(validateSkill('skills/agile-qa/SKILL.md').ok, true);
});

test('secret scan passes on a clean repo', async () => {
  const dir = await gitRepo();
  const out = await runChecks(dir, { secretScan: SECRET_SCAN }, ['secretScan']);
  assert.equal(out.ok, true, JSON.stringify(out.results));
});

test('secret scan fails when a key is committed', async () => {
  const dir = await gitRepo();
  await writeFile(join(dir, 'leak.txt'), 'AKIAABCDEFGHIJKLMNOP');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'leak'], { cwd: dir });
  const out = await runChecks(dir, { secretScan: SECRET_SCAN }, ['secretScan']);
  assert.equal(out.ok, false);
});

test('secret scan fails outside a git repository', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-nogit-'));
  const out = await runChecks(dir, { secretScan: SECRET_SCAN }, ['secretScan']);
  assert.equal(out.ok, false);
});

test('next shows active waivers for the pending gate', async () => {
  const dir = await gitRepo();
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'pkg'], { cwd: dir });
  await run(['init', '--mode', 'greenfield', '--repo', dir], dir);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  await run(['next'], dir);
  await run(['advance'], dir);
  await mkdir(join(dir, 'docs/agile'), { recursive: true });
  await run(['waive', 'G0', '--requirement', 'backlog.md', '--reason', 'tracker only', '--expires', '2099-01-01', '--approver', 'human'], dir);

  const out = await capture(['next'], dir);
  assert.match(out, /waiver: G0 backlog\.md/);
});

async function capture(args, cwd) {
  const { spawnSync } = await import('node:child_process');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const res = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
  return res.stdout + res.stderr;
}
