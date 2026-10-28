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
  const picked = [];
  for (let i = 0; i < Math.min(count, claims.length); i++) {
    picked.push(claims[(offset + i) % claims.length]);
  }
  return picked;
}

export async function recordAudit(root, { gate, verdict, checked, note }) {
  if (!Number.isInteger(checked) || checked <= 0) {
    throw new Error('audit requires --checked greater than zero');
  }
  if (!['pass', 'fail'].includes(verdict)) throw new Error('audit verdict must be pass or fail');
  if (!note || !note.trim()) throw new Error('audit requires --note describing what was checked');
  const state = await loadState(root);
  state.audits = state.audits ?? {};
  state.audits[gate] = { verdict, checked, note: note.trim(), sprint: state.sprint, at: new Date().toISOString() };
  await saveState(root, state);
  return state.audits[gate];
}

export async function validateAudit(root, gate) {
  const state = await loadState(root).catch(() => ({ audits: {} }));
  const record = state.audits?.[gate];
  return Boolean(record && record.verdict === 'pass' && record.checked > 0 && record.sprint === state.sprint);
}
