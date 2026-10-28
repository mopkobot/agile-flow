import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir, loadState, saveState } from './state.mjs';

export class WaiverError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WaiverError';
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addWaiver(root, { gate, requirement = 'gate', reason, expires, approver }) {
  if (approver !== 'human') throw new WaiverError('only a human may sign a waiver');
  if (!gate) throw new WaiverError('waiver requires a gate');
  if (!reason || !reason.trim()) throw new WaiverError('waiver requires a reason');
  if (!DATE.test(expires ?? '')) throw new WaiverError('waiver requires --expires YYYY-MM-DD');
  const waiver = {
    gate,
    requirement: requirement ?? 'gate',
    reason: reason.trim(),
    expires,
    approver: 'human',
    at: new Date().toISOString(),
  };
  const state = await loadState(root);
  state.waivers.push(waiver);
  await saveState(root, state);
  const dir = join(agileDir(root), 'waivers');
  await mkdir(dir, { recursive: true });
  const line = `- gate: ${gate}\n  requirement: ${waiver.requirement}\n  reason: ${waiver.reason}\n  expires: ${expires}\n  approver: human\n  at: ${waiver.at}\n`;
  await writeFile(join(dir, `${gate}.md`), `# Waivers for ${gate}\n\n${line}`, { encoding: 'utf8', flag: 'a' });
  return waiver;
}

export function activeWaivers(state, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return (state.waivers ?? []).filter((w) => w.expires >= today);
}

export function waiverCovers(waivers, gate, failure) {
  const text = failure.toLowerCase();
  return waivers.some(
    (w) => w.gate === gate && (w.requirement === 'gate' || text.includes(w.requirement.toLowerCase())),
  );
}
