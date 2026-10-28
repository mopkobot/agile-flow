import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initFlow, freshState } from '../src/state.mjs';
import { issueRoleToken } from '../src/identity.mjs';
import { run } from '../src/cli.mjs';

export function baseState() {
  return freshState('greenfield');
}

export function pick(action) {
  const { phase, role, gate, blocked } = action;
  return { phase, role, gate, blocked };
}

export async function seededRepo(mode = 'greenfield') {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await initFlow(repo, mode);
  return repo;
}

export async function signAs(root, gate, role, evidence, extra = []) {
  const token = await issueRoleToken(root, role);
  const previous = process.env.AGILE_ROLE_TOKEN;
  process.env.AGILE_ROLE_TOKEN = token;
  try {
    return await run(
      ['sign', gate, '--role', role, '--verdict', 'pass', '--evidence', evidence, ...extra],
      root,
    );
  } finally {
    if (previous === undefined) delete process.env.AGILE_ROLE_TOKEN;
    else process.env.AGILE_ROLE_TOKEN = previous;
  }
}
