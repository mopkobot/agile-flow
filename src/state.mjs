import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
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
  for (const gate of GATES) {
    if (!state.gates[gate]) throw new StateError(`${STATE_PATH} is missing ${gate}; refusing to continue`);
  }
  if (typeof state.gateRetries !== 'object' || state.gateRetries === null) {
    throw new StateError(`${STATE_PATH} is missing gateRetries; refusing to continue`);
  }
  return state;
}

const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 10000;

async function acquireLock(root) {
  const lockPath = `${statePath(root)}.lock`;
  const started = Date.now();
  for (;;) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(`${process.pid}\n`);
      await handle.close();
      return async () => {
        await unlink(lockPath).catch(() => {});
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const { mtimeMs } = await import('node:fs/promises').then((fs) => fs.stat(lockPath));
      if (Date.now() - mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new StateError('state lock is held; another agent is writing, retry');
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

export async function saveState(root, state) {
  await mkdir(dirname(statePath(root)), { recursive: true });
  const release = await acquireLock(root);
  try {
    const onDisk = await readFile(statePath(root), 'utf8').catch(() => null);
    const diskRevision = onDisk ? JSON.parse(onDisk).revision : null;
    if (diskRevision !== null && state.revision !== diskRevision) {
      throw new StateError(
        `stale state: disk has revision ${diskRevision}, caller has ${state.revision}; reload and retry`,
      );
    }
    const next = { ...state, revision: (diskRevision ?? 0) + 1 };
    const tmp = `${statePath(root)}.tmp-${process.pid}`;
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tmp, statePath(root));
    state.revision = next.revision;
  } finally {
    await release();
  }
}

export function freshState(mode) {
  const gates = {};
  for (const gate of GATES) gates[gate] = { status: 'locked', at: null };
  return {
    version: 1,
    revision: 0,
    targetRepo: null,
    mode,
    sprint: 1,
    phase: 'intake',
    activeRole: 'agile-flow',
    writeScope: [],
    stageBase: null,
    stageIgnored: [],
    gates,
    stories: {},
    gateRetries: {},
    waivers: [],
    escalation: null,
    stackDetected: false,
    humanAuth: null,
    audits: {},
  };
}

export async function initFlow(root, mode) {
  if (mode !== 'greenfield' && mode !== 'brownfield') {
    throw new StateError('--mode must be greenfield or brownfield');
  }
  const existing = await readdir(agileDir(root)).catch(() => []);
  if (existing.length > 0 && !existing.includes('state.json')) {
    throw new StateError('docs/agile holds artifacts but no state.json; refusing to erase gate history');
  }
  try {
    await loadState(root);
    return { created: false, state: await loadState(root) };
  } catch (err) {
    if (!(err instanceof StateError) || !err.message.includes('no state file')) throw err;
  }
  const state = freshState(mode);
  state.targetRepo = root;
  const { resolvePassphrase, hashPassphrase } = await import('./auth.mjs');
  const passphrase = await resolvePassphrase('Human passphrase (used to authenticate sign-offs): ');
  if (passphrase) state.humanAuth = hashPassphrase(passphrase);
  await mkdir(agileDir(root), { recursive: true });
  await saveState(root, state);
  return { created: true, state };
}
