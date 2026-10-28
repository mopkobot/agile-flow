import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { loadState } from '../src/state.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'af-trk-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir], dir), 0);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  await run(['next'], dir);
  await run(['advance'], dir);
  await run(['next'], dir);

  const base = join(dir, 'docs/agile');
  await writeFile(join(base, 'vision.md'), '# Vision\n');
  await mkdir(join(base, 'stories'), { recursive: true });
  await writeFile(join(base, 'stories', 'S-001.md'), '# S-001 Greet\n\n## Story\nAs a visitor.\n');
  const state = await loadState(dir);
  state.stories['S-001'] = { dor: 'pass', dod: 'pending', status: 'ready' };
  await writeFile(join(base, 'state.json'), JSON.stringify(state));
  return dir;
}

async function fakeGh(dir, listJson = '[]', createUrl = 'https://github.com/o/r/issues/42') {
  const bin = join(dir, 'bin');
  await mkdir(bin, { recursive: true });
  const log = join(dir, 'gh.log');
  await writeFile(
    join(bin, 'gh'),
    `#!/bin/sh\necho "$@" >> "${log}"\ncase "$1 $2" in\n  "issue list") echo '${listJson}' ;;\n  "issue create") echo "${createUrl}" ;;\n  *) exit 0 ;;\nesac\n`,
  );
  await chmod(join(bin, 'gh'), 0o755);
  return {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, AGILE_GH_LOG: log },
    log: async () => (await readFile(log, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean),
  };
}

test('story status moves dev then qa then done, with role checks', async () => {
  const dir = await repo();
  assert.equal(await run(['story', 'S-001', 'in-dev', '--role', 'qa'], dir), 1);
  assert.equal(await run(['story', 'S-001', 'in-dev', '--role', 'dev'], dir), 0);
  assert.equal(await run(['story', 'S-001', 'in-dev', '--role', 'dev'], dir), 0);
  assert.equal(await run(['story', 'S-001', 'in-qa', '--role', 'dev'], dir), 1);
  assert.equal(await run(['story', 'S-001', 'in-qa', '--role', 'qa'], dir), 0);
  assert.equal(await run(['story', 'S-001', 'done', '--role', 'qa'], dir), 1);
  assert.equal(await run(['story', 'S-001', 'done', '--role', 'flow'], dir), 0);

  const state = await loadState(dir);
  assert.equal(state.stories['S-001'].status, 'done');
  assert.equal(state.stories['S-001'].history.length, 3);
});

test('story status refuses a story that failed DoR', async () => {
  const dir = await repo();
  const state = await loadState(dir);
  state.stories['S-001'].dor = 'pending';
  await writeFile(join(dir, 'docs/agile/state.json'), JSON.stringify(state));
  assert.equal(await run(['story', 'S-001', 'in-dev', '--role', 'dev'], dir), 1);
});

test('tracker sync dry-run prints commands without calling gh', async () => {
  const dir = await repo();
  const gh = await fakeGh(dir);
  const out = await capture(['tracker', 'sync', '--dry-run'], dir, gh.env);
  assert.match(out, /gh issue list/);
  assert.deepEqual(await gh.log(), []);
});

test('tracker sync creates an issue and labels it for the current story status', async () => {
  const dir = await repo();
  await run(['story', 'S-001', 'in-dev', '--role', 'dev'], dir);
  const gh = await fakeGh(dir);
  const code = await run(['tracker', 'sync'], dir, { env: gh.env });
  assert.equal(code, 0);
  const calls = await gh.log();
  assert.ok(calls.some((c) => c.startsWith('issue create')), calls.join('\n'));
  assert.ok(calls.some((c) => c.startsWith('issue edit 42') && c.includes('status:in-dev')), calls.join('\n'));
  const state = await loadState(dir);
  assert.equal(state.stories['S-001'].issue, 42);
});

test('tracker sync reuses an existing issue number', async () => {
  const dir = await repo();
  const gh = await fakeGh(dir, '[{"number":7,"title":"S-001 Greet"}]');
  assert.equal(await run(['tracker', 'sync'], dir, { env: gh.env }), 0);
  const calls = await gh.log();
  assert.ok(!calls.some((c) => c.startsWith('issue create')), calls.join('\n'));
  const state = await loadState(dir);
  assert.equal(state.stories['S-001'].issue, 7);
});

async function capture(args, cwd, env) {
  const { spawnSync } = await import('node:child_process');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const res = spawnSync(process.execPath, [bin, ...args], { cwd, env, encoding: 'utf8' });
  return res.stdout + res.stderr;
}
