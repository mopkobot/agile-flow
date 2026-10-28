import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listClaims } from '../src/audit.mjs';
import { freshState } from '../src/state.mjs';

async function repo(files) {
  const dir = await mkdtemp(join(tmpdir(), 'af-audit-'));
  await mkdir(join(dir, 'docs/agile'), { recursive: true });
  await writeFile(join(dir, 'docs/agile/state.json'), JSON.stringify(freshState('greenfield')));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, 'docs/agile', rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
  }
  return dir;
}

test('sampling prefers security, coverage, and reliability claims', async () => {
  const dir = await repo({
    'build/S-001/review.md': [
      '# R',
      '',
      '## Verdict',
      'pass',
      '',
      '## Findings',
      '- src/app.mjs:1 rename for clarity',
      '- src/auth.mjs:4 token check missing, security risk',
    ].join('\n'),
    'quality/evidence/S-001.md': '# E\n\n```\n$ npm test\n# pass 4\n```\n',
  });
  const claims = await listClaims(dir, 3);
  assert.match(claims[0], /security/i);
  assert.ok(claims.some((c) => /auth\.mjs/.test(c)));
});
