import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSkill } from '../src/skills.mjs';

const root = join(import.meta.dirname, '..', 'skills');
const read = (role) => readFile(join(root, role, 'SKILL.md'), 'utf8');

test('architect carries Fowler and Ford architecture canon', async () => {
  const a = await read('agile-architect');
  for (const term of [
    'shared understanding',
    'cruft',
    'architecture quantum',
    'fitness function',
    'transitional architecture',
    'Conway',
    'reversib',
    'strangler',
    'trade-off',
    'incremental',
  ]) {
    assert.match(a, new RegExp(term, 'i'), term);
  }
  assert.equal(validateSkill(join(root, 'agile-architect', 'SKILL.md')).ok, true);
});

test('dev carries pragmatic, clean code, legacy, and refactoring canon', async () => {
  const d = await read('agile-dev');
  for (const term of [
    'characterization',
    'seam',
    'sprout',
    'wrap',
    'two hats',
    'orthogon',
    'broken windows',
    'tracer',
    'command-query',
    'golden master',
    'preparatory',
    'DRY',
  ]) {
    assert.match(d, new RegExp(term, 'i'), term);
  }
  assert.equal(validateSkill(join(root, 'agile-dev', 'SKILL.md')).ok, true);
});

test('the tech lead owns the build plan, not the developer', async () => {
  const dev = await read('agile-dev');
  const flow = await read('agile-flow');
  assert.ok(!/Plan mode/i.test(dev), 'dev must not own a plan mode');
  assert.match(dev, /plan\.md.*from the tech lead/i);
  assert.match(flow, /Spawn `agile-tech-lead` to write `docs\/agile\/build\/<story-id>\/plan\.md`/);
});
