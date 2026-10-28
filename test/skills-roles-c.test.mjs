import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSkillTree } from '../src/skills.mjs';

const root = join(import.meta.dirname, '..', 'skills');

test('all nine skills validate and are present', async () => {
  const names = (await readdir(root)).sort();
  assert.deepEqual(names, [
    'agile-architect',
    'agile-ba',
    'agile-dev',
    'agile-flow',
    'agile-po',
    'agile-qa',
    'agile-sre',
    'agile-tech-lead',
    'agile-ux',
  ]);
  const out = validateSkillTree(root);
  assert.equal(out.ok, true, out.failures.join('\n'));
});

test('every skill names at least three forbidden actions', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of await readdir(root)) {
    const text = await readFile(join(root, name, 'SKILL.md'), 'utf8');
    const block = text.split('must_not:')[1].split('handoff:')[0];
    const items = block.split('\n').filter((l) => l.trim().startsWith('- '));
    assert.ok(items.length >= 3, `${name} has ${items.length} must_not items`);
  }
});
