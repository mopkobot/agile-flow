import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack, parseProfile, renderProfile } from '../src/stack.mjs';

test('detects node and round-trips the profile', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const p = detectStack(repo);
  assert.equal(p.language, 'node');
  const round = parseProfile(renderProfile(p));
  assert.equal(round.test, 'npm test');
  assert.equal(round.language, 'node');
});

test('detects python and renders missing layers as not applicable', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await writeFile(join(repo, 'pyproject.toml'), '[project]\nname="x"\n');
  const p = detectStack(repo);
  assert.equal(p.language, 'python');
  const md = renderProfile(p);
  assert.match(md, /not applicable/);
  assert.equal(parseProfile(md).a11y, null);
});

test('returns null when nothing is detected', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  assert.equal(detectStack(repo), null);
});
