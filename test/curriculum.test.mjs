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

test('dev runs RED, GREEN, then REFACTOR, and the orchestrator keeps that order', async () => {
  const dev = await read('agile-dev');
  const flow = await read('agile-flow');
  assert.match(dev, /Refactor mode[\s\S]*after GREEN/i);
  assert.match(dev, /refactor\.log/);
  assert.match(dev, /no refactor:/i);
  const red = flow.indexOf('test-author mode');
  const green = flow.indexOf('implementer mode');
  const refactor = flow.indexOf('refactor mode');
  assert.ok(red !== -1 && green > red && refactor > green, 'flow spawn order must be RED, GREEN, REFACTOR');
});

test('the tech lead owns the build plan, not the developer', async () => {
  const dev = await read('agile-dev');
  const flow = await read('agile-flow');
  assert.ok(!/Plan mode/i.test(dev), 'dev must not own a plan mode');
  assert.match(dev, /plan\.md.*from the tech lead/i);
  assert.match(flow, /Spawn `agile-tech-lead` to write `docs\/agile\/build\/<story-id>\/plan\.md`/);
});

test('the tech lead reviews the dev work; the dev never writes review.md', async () => {
  const dev = await read('agile-dev');
  const flow = await read('agile-flow');
  const lead = await read('agile-tech-lead');
  assert.match(dev, /Write `.*review\.md`.*tech lead/i);
  assert.doesNotMatch(flow, /agile-dev` in reviewer mode/i);
  assert.match(flow, /Spawn `agile-tech-lead` in review mode to write `review\.md`/);
  assert.match(lead, /Write `build\/<story-id>\/review\.md`/);
});

test('the orchestrator asks brownfield operators to define a harness', async () => {
  const flow = await read('agile-flow');
  assert.match(flow, /brownfield/i);
  assert.match(flow, /harness/i);
  assert.match(flow, /ask the operator/i);
  const template = await readFile(join(root, '..', 'templates', 'harness.md'), 'utf8');
  for (const heading of ['## Product context', '## Architecture context', '## Reliability', '## Agent rules', '## Verification']) {
    assert.ok(template.includes(heading), heading);
  }
});

test('dev always takes the highest-priority ready story', async () => {
  const dev = await read('agile-dev');
  assert.match(dev, /highest[- ]priority/i);
  assert.match(dev, /refuse/i);
  const flow = await read('agile-flow');
  assert.match(flow, /highest[- ]priority/i);
});

test('the retro closes the loop on process, product, and debt actions', async () => {
  const flow = await read('agile-flow');
  assert.match(flow, /process.*actions change how the team works/i);
  assert.match(flow, /product.*actions become cards/i);
  assert.match(flow, /debt.*actions become rows/i);
  assert.match(flow, /retro check/);
});

test('the orchestrator asks for a debt allocation and G2 enforces it', async () => {
  const flow = await read('agile-flow');
  assert.match(flow, /percentage of every sprint/i);
  assert.match(flow, /debt set/);
  assert.match(flow, /G2 refuses/i);
  const po = await read('agile-po');
  assert.match(po, /Debt allocation/i);
});
