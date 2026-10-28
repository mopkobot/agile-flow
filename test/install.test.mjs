import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(import.meta.dirname, '..', 'install.sh');

test('install links all nine skills into the target directory', async () => {
  const target = await mkdtemp(join(tmpdir(), 'af-install-'));
  execFileSync('bash', [script], { env: { ...process.env, AGILE_SKILLS_TARGET: target }, stdio: 'ignore' });
  for (const name of ['agile-flow', 'agile-po', 'agile-ba', 'agile-ux', 'agile-architect', 'agile-tech-lead', 'agile-dev', 'agile-qa', 'agile-sre']) {
    const link = join(target, name);
    assert.equal((await lstat(link)).isSymbolicLink(), true, name);
    assert.match(await readlink(link), new RegExp(`${name}/?$`));
  }
});

test('install refuses to replace a real directory', async () => {
  const target = await mkdtemp(join(tmpdir(), 'af-install-'));
  await mkdir(join(target, 'agile-po'));
  await writeFile(join(target, 'agile-po', 'keep.txt'), 'user work');
  assert.throws(() =>
    execFileSync('bash', [script], { env: { ...process.env, AGILE_SKILLS_TARGET: target }, stdio: 'ignore' }),
  );
});
