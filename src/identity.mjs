import { randomBytes } from 'node:crypto';
import { hashPassphrase, verifyPassphrase } from './auth.mjs';
import { loadState, saveState } from './state.mjs';

export const ROLE_TOKEN_ENV = 'AGILE_ROLE_TOKEN';

export const IDENTIFIED_ROLES = ['po', 'ba', 'ux', 'architect', 'tech-lead', 'dev', 'qa', 'sre', 'auditor'];

export class IdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdentityError';
  }
}

export async function issueRoleToken(root, role) {
  if (!IDENTIFIED_ROLES.includes(role)) throw new IdentityError(`unknown role: ${role}`);
  const token = `af_${randomBytes(24).toString('hex')}`;
  const state = await loadState(root);
  state.identity = state.identity ?? {};
  state.identity[role] = { ...hashPassphrase(token), issuedAt: new Date().toISOString() };
  await saveState(root, state);
  return token;
}

export async function verifyRoleToken(root, role, token) {
  const state = await loadState(root);
  const record = state.identity?.[role];
  if (!record) return { ok: false, reason: `no identity issued for ${role}; run "agile-flow identity issue --role ${role}"` };
  if (!token) return { ok: false, reason: `missing ${ROLE_TOKEN_ENV} for role ${role}` };
  if (!verifyPassphrase(token, record)) return { ok: false, reason: `token rejected for role ${role}` };
  return { ok: true, reason: null };
}
