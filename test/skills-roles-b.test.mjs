import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSkill } from '../src/skills.mjs';

const root = join(import.meta.dirname, '..', 'skills');

test('architect and tech lead validate', () => {
  for (const s of ['agile-architect', 'agile-tech-lead']) {
    const out = validateSkill(join(root, s, 'SKILL.md'));
    assert.equal(out.ok, true, `${s}: ${out.failures.join('; ')}`);
  }
});

test('architect and tech lead declare distinct ownership', async () => {
  const owned = async (role) => {
    const text = await readFile(join(root, role, 'SKILL.md'), 'utf8');
    return text.split('owned_paths:')[1].split('must_not:')[0];
  };
  const a = await owned('agile-architect');
  const t = await owned('agile-tech-lead');
  assert.ok(a.includes('docs/agile/architecture/'));
  assert.ok(!a.includes('architecture/debt.md'));
  assert.ok(t.includes('architecture/debt.md'));
});

test('architect owns system structure and tech lead owns implementation direction', async () => {
  const a = await readFile(join(root, 'agile-architect', 'SKILL.md'), 'utf8');
  const t = await readFile(join(root, 'agile-tech-lead', 'SKILL.md'), 'utf8');
  assert.match(a, /fitness/i);
  assert.match(a, /NFR/i);
  assert.match(t, /debt/i);
  assert.match(t, /seam|plan\.md/i);
  assert.match(t, /must_not:[\s\S]*architecture\//);
});
