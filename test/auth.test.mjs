import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassphrase, verifyPassphrase } from '../src/auth.mjs';
import { run } from '../src/cli.mjs';

async function repo(pass = 'correct-horse') {
  const dir = await mkdtemp(join(tmpdir(), 'af-auth-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  const previous = process.env.AGILE_HUMAN_PASSPHRASE;
  process.env.AGILE_HUMAN_PASSPHRASE = pass;
  try {
    assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir], dir), 0);
  } finally {
    if (previous === undefined) delete process.env.AGILE_HUMAN_PASSPHRASE;
    else process.env.AGILE_HUMAN_PASSPHRASE = previous;
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  return dir;
}

async function signHuman(dir, passphrase) {
  const previous = process.env.AGILE_HUMAN_PASSPHRASE;
  if (passphrase === null) delete process.env.AGILE_HUMAN_PASSPHRASE;
  else process.env.AGILE_HUMAN_PASSPHRASE = passphrase;
  try {
    return await run(
      ['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'approved'],
      dir,
    );
  } finally {
    if (previous === undefined) delete process.env.AGILE_HUMAN_PASSPHRASE;
    else process.env.AGILE_HUMAN_PASSPHRASE = previous;
  }
}

test('passphrase hashing round-trips and rejects wrong input', () => {
  const record = hashPassphrase('correct-horse');
  assert.equal(verifyPassphrase('correct-horse', record), true);
  assert.equal(verifyPassphrase('wrong-horse', record), false);
  assert.equal(verifyPassphrase('', record), false);
});

test('short passphrases are refused', () => {
  assert.throws(() => hashPassphrase('short'));
});

test('init stores only a salted hash', async () => {
  const dir = await repo();
  const state = JSON.parse(await readFile(join(dir, 'docs/agile/state.json'), 'utf8'));
  assert.ok(state.humanAuth.hash);
  assert.ok(state.humanAuth.salt);
  assert.notEqual(state.humanAuth.hash, 'correct-horse');
});

test('human sign-off requires the correct passphrase', async () => {
  const dir = await repo();
  await writeFile(join(dir, 'docs/agile/vision.md'), '# Vision\n');
  assert.equal(await signHuman(dir, 'wrong-horse'), 1);
  assert.equal(await signHuman(dir, null), 1);
  assert.equal(await signHuman(dir, 'correct-horse'), 0);
});

test('an agent shell without a tty cannot sign as human', async () => {
  const dir = await repo();
  await writeFile(join(dir, 'docs/agile/vision.md'), '# Vision\n');
  const bin = join(import.meta.dirname, '..', 'bin', 'agile-flow.mjs');
  const env = { ...process.env };
  delete env.AGILE_HUMAN_PASSPHRASE;
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(
    process.execPath,
    [bin, 'sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'x'],
    { cwd: dir, env, encoding: 'utf8' },
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /passphrase/);
});
