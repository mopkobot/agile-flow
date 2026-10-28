import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';

test('init writes a stack profile when the stack is detected', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  await run(['init', '--mode', 'greenfield', '--repo', repo], repo);
  const md = await readFile(join(repo, 'docs/agile/stack-profile.md'), 'utf8');
  assert.match(md, /\| language \| node \|/);
});

test('init records an undetected stack in state and asks for it', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  const code = await run(['init', '--mode', 'greenfield', '--repo', repo], repo);
  assert.equal(code, 0);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.stackDetected, false);
});
