import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSkill } from '../src/skills.mjs';

const root = join(import.meta.dirname, '..', 'skills');
const roles = ['agile-po', 'agile-ba', 'agile-tech-lead', 'agile-architect', 'agile-qa'];

test('every decision role forbids assumptions and requires a question', async () => {
  for (const role of roles) {
    const text = await readFile(join(root, role, 'SKILL.md'), 'utf8');
    assert.match(text, /## No assumptions/, `${role} lacks a No assumptions section`);
    assert.match(text, /never (make|invent|assume)/i, `${role} lacks the prohibition wording`);
    assert.match(text, /ask/i, `${role} does not require asking`);
    assert.equal(validateSkill(join(root, role, 'SKILL.md')).ok, true, role);
  }
});

test('architect requires domain-driven design and ubiquitous language', async () => {
  const text = await readFile(join(root, 'agile-architect', 'SKILL.md'), 'utf8');
  for (const term of ['domain-driven design', 'ubiquitous language', 'bounded context', 'aggregate', 'anti-corruption', 'invariant']) {
    assert.match(text, new RegExp(term, 'i'), term);
  }
});
