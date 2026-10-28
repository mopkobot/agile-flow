import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { issueRoleToken, verifyRoleToken } from '../src/identity.mjs';

process.env.AGILE_HUMAN_PASSPHRASE ||= 'test-passphrase';

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'af-id-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  await run(['init', '--mode', 'greenfield', '--repo', dir], dir);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });
  await writeFile(join(dir, 'docs/agile/vision.md'), '# Vision\n');
  return dir;
}

async function withEnv(vars, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('a role cannot sign without an issued token', async () => {
  const dir = await repo();
  const code = await withEnv({ AGILE_ROLE_TOKEN: null }, () =>
    run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], dir),
  );
  assert.equal(code, 1);
});

test('a role cannot use another role token', async () => {
  const dir = await repo();
  const poToken = await issueRoleToken(dir, 'po');
  await issueRoleToken(dir, 'qa');
  const code = await withEnv({ AGILE_ROLE_TOKEN: poToken }, () =>
    run(['sign', 'G0', '--role', 'qa', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], dir),
  );
  assert.equal(code, 1);
});

test('the matching token signs and only its hash is stored', async () => {
  const dir = await repo();
  const token = await issueRoleToken(dir, 'po');
  const state = JSON.parse(await readFile(join(dir, 'docs/agile/state.json'), 'utf8'));
  assert.notEqual(state.identity.po.hash, token);
  assert.equal(await verifyRoleToken(dir, 'po', token).then((r) => r.ok), true);

  const code = await withEnv({ AGILE_ROLE_TOKEN: token }, () =>
    run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], dir),
  );
  assert.equal(code, 0);
});

test('issuing a token requires the human passphrase', async () => {
  const dir = await repo();
  const bad = await withEnv({ AGILE_HUMAN_PASSPHRASE: 'wrong-passphrase' }, () =>
    run(['identity', 'issue', '--role', 'dev'], dir),
  );
  assert.equal(bad, 1);
});
