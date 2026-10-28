import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir } from './state.mjs';

export const ROLES = [
  'po',
  'ba',
  'ux',
  'architect',
  'tech-lead',
  'dev',
  'qa',
  'sre',
  'flow',
  'human',
];

const VERDICTS = ['pass', 'fail', 'pass-with-risk'];

export class ReviewError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReviewError';
  }
}

export function reviewsDir(root) {
  return join(agileDir(root), 'reviews');
}

export function reviewPath(root, gate, role) {
  return join(reviewsDir(root), `${gate}-${role}.yaml`);
}

async function assertEvidence(root, evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new ReviewError('at least one --evidence path is required');
  }
  for (const rel of evidence) {
    try {
      await access(join(root, rel));
    } catch {
      throw new ReviewError(`evidence does not exist: ${rel}`);
    }
  }
}

export async function recordReview(root, { gate, role, verdict, evidence }) {
  if (!ROLES.includes(role)) throw new ReviewError(`unknown role: ${role}`);
  if (!VERDICTS.includes(verdict)) throw new ReviewError(`unknown verdict: ${verdict}`);
  await assertEvidence(root, evidence);
  await mkdir(reviewsDir(root), { recursive: true });
  const body = [
    `gate: ${gate}`,
    `role: ${role}`,
    `verdict: ${verdict}`,
    'evidence:',
    ...evidence.map((e) => `  - ${e}`),
    'open_risks: []',
    `at: ${new Date().toISOString()}`,
    '',
  ].join('\n');
  const path = reviewPath(root, gate, role);
  await writeFile(path, body, 'utf8');
  return path;
}

export function parseReview(text) {
  const out = { evidence: [], open_risks: [] };
  let listKey = null;
  for (const line of text.split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      out[listKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '') {
      listKey = key;
      out[key] = [];
    } else {
      listKey = null;
      out[key] = value;
    }
  }
  return out;
}

export async function readReviews(root, gate) {
  let files;
  try {
    files = await readdir(reviewsDir(root));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files.sort()) {
    if (!file.startsWith(`${gate}-`) || !file.endsWith('.yaml')) continue;
    out.push(parseReview(await readFile(join(reviewsDir(root), file), 'utf8')));
  }
  return out;
}

export async function validateReviews(root, gate, requiredRoles, artifactAuthors = {}, waivers = []) {
  const failures = [];
  const records = await readReviews(root, gate);
  const byRole = new Map(records.map((r) => [r.role, r]));

  for (const role of requiredRoles) {
    const record = byRole.get(role);
    if (!record) {
      failures.push(`missing sign-off: ${role}`);
      continue;
    }
    if (record.verdict === 'fail') failures.push(`sign-off failed: ${role}`);
    if (record.verdict === 'pass-with-risk' && !waivers.some((w) => w.gate === gate)) {
      failures.push(`pass-with-risk without waiver: ${role}`);
    }
    for (const rel of record.evidence) {
      try {
        await access(join(root, rel));
      } catch {
        failures.push(`sign-off evidence missing: ${role} -> ${rel}`);
      }
    }
    for (const [artifact, author] of Object.entries(artifactAuthors)) {
      if (author === role && record.evidence.includes(artifact)) {
        failures.push(`self-approval: ${role} signed ${artifact}, which it authored`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}
