import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initFlow, freshState } from '../src/state.mjs';

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
