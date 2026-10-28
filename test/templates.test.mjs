import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'templates');

test('story template carries every required section', async () => {
  const md = await readFile(join(dir, 'story.md'), 'utf8');
  for (const h of [
    '## Story',
    '## Acceptance criteria',
    '## Non-goals',
    '## Test plan',
    '## Wireframe',
    '## NFRs',
    '## Open questions',
    '## Slice',
  ]) {
    assert.ok(md.includes(h), h);
  }
  assert.match(md, /As a .*, I want .*, so that /);
});

test('adr template carries the decision record sections', async () => {
  const md = await readFile(join(dir, 'adr.md'), 'utf8');
  for (const h of ['## Status', '## Context', '## Decision', '## Consequences', '## Alternatives']) {
    assert.ok(md.includes(h), h);
  }
});

test('review template matches the sign-off contract', async () => {
  const yaml = await readFile(join(dir, 'review.yaml'), 'utf8');
  for (const key of ['gate:', 'role:', 'verdict:', 'evidence:', 'open_risks:', 'at:']) {
    assert.ok(yaml.includes(key), key);
  }
});

test('postmortem template forbids blame and requires actions', async () => {
  const md = await readFile(join(dir, 'postmortem.md'), 'utf8');
  assert.match(md, /## Timeline/);
  assert.match(md, /## Contributing causes/);
  assert.match(md, /## Actions/);
  assert.match(md, /[Nn]o individual blame/);
});

test('checklists carry every DoR and DoD item', async () => {
  const md = await readFile(join(dir, 'checklists.md'), 'utf8');
  for (const item of ['wireframe', 'Given/When/Then', '80%', 'lint', 'observability', 'CI green']) {
    assert.ok(md.toLowerCase().includes(item.toLowerCase()), item);
  }
});

test('state and waiver templates exist and parse as valid shapes', async () => {
  const state = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  assert.equal(state.phase, 'intake');
  const waiver = await readFile(join(dir, 'waiver.md'), 'utf8');
  assert.match(waiver, /expires/);
});
