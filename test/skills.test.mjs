import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSkill, validateSkillTree } from '../src/skills.mjs';

async function skillFile(body) {
  const dir = await mkdtemp(join(tmpdir(), 'sk-'));
  await writeFile(join(dir, 'SKILL.md'), body);
  return join(dir, 'SKILL.md');
}

test('rejects a skill without a Boundaries block', async () => {
  const path = await skillFile('---\nname: x\ndescription: y\n---\n## Inputs\n## Outputs\n## Method\n## Refuse\n');
  const out = validateSkill(path);
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /Boundaries/);
});

test('rejects a skill without frontmatter name', async () => {
  const path = await skillFile('---\ndescription: y\n---\n## Inputs\n## Outputs\n## Boundaries\n## Method\n## Refuse\n');
  const out = validateSkill(path);
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /name/);
});

test('accepts a complete skill', async () => {
  const body = [
    '---', 'name: x', 'description: y', '---',
    '## Inputs', 'a', '## Outputs', 'b',
    '## Boundaries', 'owned_paths: docs/**', 'must_not: write code',
    '## Method', 'c', '## Refuse', 'd',
  ].join('\n');
  const path = await skillFile(body);
  assert.equal(validateSkill(path).ok, true);
});

test('validateSkillTree reports each missing skill', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sk-'));
  const out = validateSkillTree(dir);
  assert.equal(out.ok, false);
  assert.equal(out.failures.length, 1);
  assert.match(out.failures[0], /skills directory/);
});
