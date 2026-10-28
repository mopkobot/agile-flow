import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRetroActions, parseRetroActions } from '../src/retro.mjs';
import { run } from '../src/cli.mjs';
import { freshState } from '../src/state.mjs';

async function repo(retro) {
  const dir = await mkdtemp(join(tmpdir(), 'af-retro-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  const base = join(dir, 'docs/agile');
  await mkdir(join(base, 'retro'), { recursive: true });
  await mkdir(join(base, 'architecture'), { recursive: true });
  await mkdir(join(base, 'stories'), { recursive: true });
  await writeFile(join(base, 'state.json'), JSON.stringify({ ...freshState('greenfield'), phase: 'retro', sprint: 1 }));
  await writeFile(join(base, 'retro/retro-01.md'), retro);
  await writeFile(join(base, 'backlog.md'), '# Backlog\n\n## Backlog\n| rank | id | title |\n|---|---|---|\n| 1 | S-001 | greet |\n');
  await writeFile(join(base, 'architecture/debt.md'), '# Debt\n\n## Debt\n| id | debt |\n|---|---|\n| D-001 | routing |\n');
  return dir;
}

const GOOD = `# Retro\n\n## Actions\n\n| action | type | target | owner | due |\n|---|---|---|---|---|\n| tighten review | process | agile-tech-lead | tech-lead | sprint 02 |\n| add farewell | product | S-002 | po | sprint 02 |\n| split router | debt | D-001 | tech-lead | sprint 03 |\n`;

test('retro actions parse into typed rows', async () => {
  const dir = await repo(GOOD);
  const actions = await parseRetroActions(dir, 1);
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((a) => a.type), ['process', 'product', 'debt']);
});

test('process actions must name an existing skill', async () => {
  const dir = await repo(GOOD.replace('agile-tech-lead', 'agile-imaginary'));
  const failures = await checkRetroActions(dir, 1);
  assert.ok(failures.some((f) => /skill/i.test(f)), failures.join('\n'));
});

test('product actions must name a backlog or story card', async () => {
  const dir = await repo(GOOD.replace('| S-002 |', '| S-404 |'));
  const failures = await checkRetroActions(dir, 1);
  assert.ok(failures.some((f) => /card|backlog|story/i.test(f)), failures.join('\n'));
});

test('debt actions must name a debt row', async () => {
  const dir = await repo(GOOD.replace('| D-001 |', '| D-404 |'));
  const failures = await checkRetroActions(dir, 1);
  assert.ok(failures.some((f) => /debt/i.test(f)), failures.join('\n'));
});

test('dropped actions must carry a reason', async () => {
  const dir = await repo(`# Retro\n\n## Actions\n\n| action | type | target | owner | due |\n|---|---|---|---|---|\n| skip it | dropped | - | po | sprint 02 |\n`);
  const failures = await checkRetroActions(dir, 1);
  assert.ok(failures.some((f) => /reason/i.test(f)), failures.join('\n'));
});

test('advance out of retro is blocked by an invalid action', async () => {
  const dir = await repo(GOOD.replace('| D-001 |', '| D-404 |'));
  assert.equal(await run(['advance'], dir), 1);
});
