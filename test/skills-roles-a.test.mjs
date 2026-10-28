import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validateSkill } from '../src/skills.mjs';

const root = join(import.meta.dirname, '..', 'skills');

test('po, ba, ux skills validate', () => {
  for (const s of ['agile-po', 'agile-ba', 'agile-ux']) {
    const out = validateSkill(join(root, s, 'SKILL.md'));
    assert.equal(out.ok, true, `${s}: ${out.failures.join('; ')}`);
  }
});

test('each shaping role owns a disjoint set of paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const owned = async (role) => {
    const text = await readFile(join(root, role, 'SKILL.md'), 'utf8');
    const block = text.split('owned_paths:')[1].split('must_not:')[0];
    return block.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
  };
  const sets = {
    po: await owned('agile-po'),
    ba: await owned('agile-ba'),
    ux: await owned('agile-ux'),
  };
  assert.ok(sets.po.includes('docs/agile/backlog.md'));
  assert.ok(sets.ba.includes('docs/agile/stories/**'));
  assert.ok(sets.ux.includes('docs/agile/ux/**'));
  for (const [a, b] of [['po', 'ba'], ['po', 'ux'], ['ba', 'ux']]) {
    const overlap = sets[a].filter((p) => sets[b].includes(p));
    assert.deepEqual(overlap, [], `${a} and ${b} overlap`);
  }
});
