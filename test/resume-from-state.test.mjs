import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { loadState } from '../src/state.mjs';
import { nextAction } from '../src/phases.mjs';

test('state.json alone is enough to resume after a restart', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-resume-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: repo });
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });

  await run(['init', '--mode', 'greenfield', '--repo', repo], repo);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'flow'], { cwd: repo });
  await run(['next'], repo);
  await run(['advance'], repo);
  await run(['next'], repo);

  const base = join(repo, 'docs/agile');
  await mkdir(base, { recursive: true });
  await writeFile(join(base, 'vision.md'), '# Vision\n\n## Vision\nv\n\n## Success metrics\nm\n');
  await writeFile(join(base, 'personas.md'), '# Personas\n\n## Personas\np\n');
  await writeFile(join(base, 'success-metrics.md'), '# Metrics\n\n## Metrics\nm\n');
  await writeFile(join(base, 'backlog.md'), '# Backlog\n\n## Backlog\nb\n');
  await run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo);
  await run(['sign', 'G0', '--role', 'human', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md', '--note', 'operator approved'], repo);
  assert.equal(await run(['check', 'G0'], repo), 0);
  assert.equal(await run(['advance'], repo), 0);

  // A fresh session reads only the state file and knows exactly where it is.
  const state = await loadState(repo);
  const action = nextAction(state);
  assert.equal(action.phase, 'shaping');
  assert.equal(action.role, 'agile-ba');
  assert.equal(action.blocked, null);
});
