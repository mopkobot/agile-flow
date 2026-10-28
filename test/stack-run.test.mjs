import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../src/stack.mjs';

function available(command) {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('the java detector points at the maven binary', (t) => {
  if (!available('mvn')) {
    t.skip('mvn is not installed on this machine; command shape is covered by stack-detect');
    return;
  }
  const out = execFileSync('mvn', ['-v'], { encoding: 'utf8' });
  assert.match(out, /Apache Maven/i);
});

test('the ruby detector points at a runnable bundler', async (t) => {
  if (!available('bundle')) {
    t.skip('bundler is not installed on this machine');
    return;
  }
  const dir = mkdtempSyncSafe();
  await writeFile(join(dir, 'Gemfile'), 'source "https://rubygems.org"\n');
  const profile = detectStack(dir);
  assert.equal(profile.test.split(' ')[0], 'bundle');
  const out = execFileSync('bundle', ['exec', 'ruby', '-e', 'puts "bundler-ok"'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, BUNDLE_GEMFILE: join(dir, 'Gemfile') },
  });
  assert.match(out, /bundler-ok/);
});

function mkdtempSyncSafe() {
  return mkdtempSync(join(tmpdir(), 'af-run-'));
}
