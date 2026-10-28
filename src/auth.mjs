import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const HUMAN_PASSPHRASE_ENV = 'AGILE_HUMAN_PASSPHRASE';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export function hashPassphrase(passphrase, salt = randomBytes(16).toString('hex')) {
  if (!passphrase || passphrase.length < 8) {
    throw new AuthError('human passphrase must be at least 8 characters');
  }
  const hash = scryptSync(passphrase, salt, 64).toString('hex');
  return { salt, hash, algorithm: 'scrypt' };
}

export function verifyPassphrase(passphrase, record) {
  if (!record || !record.salt || !record.hash) return false;
  if (!passphrase) return false;
  const candidate = scryptSync(passphrase, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function passphraseFromEnv() {
  const value = process.env[HUMAN_PASSPHRASE_ENV];
  return value && value.length > 0 ? value : null;
}

export async function promptPassphrase(question) {
  if (!process.stdin.isTTY) return null;
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  try {
    const answer = await rl.question(question);
    return answer.trim() || null;
  } finally {
    rl.close();
  }
}

export async function resolvePassphrase(question) {
  return passphraseFromEnv() ?? (await promptPassphrase(question));
}
