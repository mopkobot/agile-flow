import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { checkDebtAllocation } from '../src/debt.mjs';

const PLAN = (percent, rows) => `# Sprint 01

## Scope
Ship the slice.

## Debt allocation
percent: ${percent}

| story | size | debt |
|---|---|---|
${rows.join('\n')}

## Stories
1. S-001
`;

test('init records the debt allocation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '20'], dir), 0);
  const state = JSON.parse(await readFile(join(dir, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.debtAllocation.percent, 20);
});

test('an invalid allocation is refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-debt-'));
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '140'], dir), 1);
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '-5'], dir), 1);
});

test('debt set changes the allocation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-debt-'));
  await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '10'], dir);
  assert.equal(await run(['debt', 'set', '25'], dir), 0);
  const state = JSON.parse(await readFile(join(dir, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.debtAllocation.percent, 25);
});

test('a plan that under-allocates debt fails the check', () => {
  const failures = checkDebtAllocation(PLAN(20, ['| S-001 | medium | no |']), 20);
  assert.ok(failures.some((f) => /debt/i.test(f)), failures.join('\n'));
});

test('a plan that meets the allocation passes', () => {
  const failures = checkDebtAllocation(
    PLAN(20, ['| S-001 | large | no |', '| S-002 | small | yes |']),
    20,
  );
  assert.deepEqual(failures, []);
});

test('the declared percent must match the configured allocation', () => {
  const failures = checkDebtAllocation(PLAN(5, ['| S-001 | small | yes |']), 20);
  assert.ok(failures.some((f) => /declared/i.test(f)), failures.join('\n'));
});

test('G2 refuses a plan that skips the debt allocation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });

  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '20'], dir), 0);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });

  const base = join(dir, 'docs/agile');
  await mkdir(join(base, 'plan'), { recursive: true });
  await writeFile(join(base, 'plan/sprint-01.md'), PLAN(20, ['| S-001 | medium | no |']));
  const state = JSON.parse(await readFile(join(base, 'state.json'), 'utf8'));
  state.phase = 'planning';
  state.stageBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  state.writeScope = ['docs/agile/**'];
  await writeFile(join(base, 'state.json'), JSON.stringify(state));
  await run(['sign', 'G2', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/plan/sprint-01.md', '--note', 'ok'], dir);
  assert.equal(await run(['check', 'G2'], dir), 1);
});

test('a plan row must resolve to a story or debt row', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'af-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: dir });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  await run(['init', '--mode', 'greenfield', '--repo', dir, '--debt-percent', '20'], dir);
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: dir });

  const base = join(dir, 'docs/agile');
  await mkdir(join(base, 'plan'), { recursive: true });
  await mkdir(join(base, 'stories'), { recursive: true });
  await mkdir(join(base, 'architecture'), { recursive: true });
  await writeFile(join(base, 'backlog.md'), '# Backlog\n\n## Backlog\n| 1 | S-001 |\n');
  await writeFile(join(base, 'architecture/debt.md'), '# Debt\n\n## Debt\n| D-001 | x |\n');
  await writeFile(join(base, 'stories/S-001.md'), '# S-001');
  await writeFile(join(base, 'plan/sprint-01.md'), PLAN(20, ['| S-001 | small | no |', '| D-999 | small | yes |']));

  const state = JSON.parse(await readFile(join(base, 'state.json'), 'utf8'));
  state.phase = 'planning';
  state.stageBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  state.writeScope = ['docs/agile/**'];
  await writeFile(join(base, 'state.json'), JSON.stringify(state));
  await run(['sign', 'G2', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/plan/sprint-01.md', '--note', 'ok'], dir);
  const out = await run(['check', 'G2'], dir);
  assert.equal(out, 1);
});

test('G3 refuses when planned debt was not completed', async () => {
  const { checkDebtCompletion } = await import('../src/debt.mjs');
  const failures = checkDebtCompletion(PLAN(20, ['| S-001 | small | no |', '| S-002 | small | yes |']), {
    stories: { 'S-001': { dod: 'pass' }, 'S-002': { dod: 'pending' } },
  });
  assert.ok(failures.some((f) => /S-002/.test(f)), failures.join('\n'));
});
