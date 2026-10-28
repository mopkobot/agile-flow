import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir, loadState, saveState } from './state.mjs';

export async function listClaims(root, count = 5) {
  const base = agileDir(root);
  const claims = [];

  const reviewDirs = await readdir(join(base, 'build')).catch(() => []);
  for (const id of reviewDirs) {
    const text = await readFile(join(base, 'build', id, 'review.md'), 'utf8').catch(() => '');
    for (const line of text.split('\n')) {
      if (/^-\s+\S+\.\w+:\d+/.test(line)) claims.push(`build/${id}/review: ${line.replace(/^-\s+/, '')}`);
    }
  }

  const evidence = await readdir(join(base, 'quality', 'evidence')).catch(() => []);
  for (const file of evidence) {
    const text = await readFile(join(base, 'quality', 'evidence', file), 'utf8').catch(() => '');
    const commands = text.match(/^\$\s+.+$/gm) ?? [];
    for (const command of commands) claims.push(`quality/evidence/${file}: ${command}`);
  }

  const state = await loadState(root).catch(() => ({ audits: {} }));
  const offset = Object.values(state.audits ?? {}).reduce((sum, a) => sum + (a.checked ?? 0), 0);
  if (claims.length === 0) return [];

  const score = (claim) => {
    if (/security|auth|secret|permission|injection|xss|csrf/i.test(claim)) return 3;
    if (/coverage|load|slo|latency|p95|error budget|availability/i.test(claim)) return 2;
    return 1;
  };
  const ranked = claims
    .map((claim, index) => ({ claim, index, score: score(claim) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.claim);

  const picked = [];
  for (let i = 0; i < Math.min(count, ranked.length); i++) {
    picked.push(ranked[(offset + i) % ranked.length]);
  }
  return picked;
}

export async function recordAudit(root, { gate, verdict, checked, note, agent = null }) {
  if (!Number.isInteger(checked) || checked <= 0) {
    throw new Error('audit requires --checked greater than zero');
  }
  if (!['pass', 'fail'].includes(verdict)) throw new Error('audit verdict must be pass or fail');
  if (!note || !note.trim()) throw new Error('audit requires --note describing what was checked');
  const state = await loadState(root);
  state.audits = state.audits ?? {};
  state.audits[gate] = { verdict, checked, note: note.trim(), agent, sprint: state.sprint, at: new Date().toISOString() };
  await saveState(root, state);
  return state.audits[gate];
}

export async function validateAudit(root, gate) {
  const state = await loadState(root).catch(() => ({ audits: {} }));
  const record = state.audits?.[gate];
  return Boolean(record && record.verdict === 'pass' && record.checked > 0 && record.sprint === state.sprint);
}
