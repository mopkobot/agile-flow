import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const STATE_PATH = 'docs/agile/state.json';
export const AGILE_DIR = 'docs/agile';

export const GATES = ['G0', 'G1', 'G2', 'G3', 'G4'];

export class StateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

export function statePath(root) {
  return join(root, STATE_PATH);
}

export function agileDir(root) {
  return join(root, AGILE_DIR);
}

export async function loadState(root) {
  let raw;
  try {
    raw = await readFile(statePath(root), 'utf8');
  } catch {
    throw new StateError(`no state file at ${STATE_PATH}; run "agile-flow init" first`);
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    throw new StateError(`${STATE_PATH} is not valid JSON; refusing to continue`);
  }
  if (state.version !== 1 || !state.phase || !state.gates) {
    throw new StateError(`${STATE_PATH} is missing required fields; refusing to continue`);
  }
  return state;
}

export async function saveState(root, state) {
  await mkdir(dirname(statePath(root)), { recursive: true });
  await writeFile(statePath(root), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function freshState(mode) {
  const gates = {};
  for (const gate of GATES) gates[gate] = { status: 'locked', at: null };
  return {
    version: 1,
    targetRepo: null,
    mode,
    sprint: 1,
    phase: 'intake',
    activeRole: 'agile-flow',
    writeScope: [],
    stageBase: null,
    gates,
    stories: {},
    gateRetries: {},
    waivers: [],
    escalation: null,
  };
}

export async function initFlow(root, mode) {
  if (mode !== 'greenfield' && mode !== 'brownfield') {
    throw new StateError('--mode must be greenfield or brownfield');
  }
  try {
    await loadState(root);
    return { created: false, state: await loadState(root) };
  } catch (err) {
    if (!(err instanceof StateError) || !err.message.includes('no state file')) throw err;
  }
  const state = freshState(mode);
  state.targetRepo = root;
  await mkdir(agileDir(root), { recursive: true });
  await saveState(root, state);
  return { created: true, state };
}
