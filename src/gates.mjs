import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir, loadState, saveState } from './state.mjs';
import { globToRegExp, ROLE_SCOPE, checkBoundary } from './boundary.mjs';
import { parseProfile } from './stack.mjs';
import { validateReviews } from './reviews.mjs';
import { activeWaivers, waiverCovers } from './waivers.mjs';

const md = (path, headings) => ({ path, headings });

export const GATE_DEFS = {
  G0: {
    artifacts: [
      md('vision.md', ['## Vision', '## Success metrics']),
      md('personas.md', ['## Personas']),
      md('success-metrics.md', ['## Metrics']),
      md('backlog.md', ['## Backlog']),
    ],
    roles: ['po', 'human'],
    checks: ['secretScan'],
  },
  G1: {
    artifacts: [
      md('architecture/system.md', ['## System']),
      md('architecture/nfrs.md', ['## NFRs']),
      md('architecture/fitness-functions.md', ['## Fitness functions']),
      md('architecture/adrs/*.md', ['## Status', '## Decision']),
      md('ux/flows.md', ['## Flows']),
      md('ux/tokens.json', []),
      md('ux/wireframes/*.html', []),
    ],
    roles: ['architect', 'tech-lead', 'ux', 'human'],
    checks: ['secretScan', 'lint'],
  },
  G2: {
    artifacts: [md('plan/sprint-*.md', ['## Scope', '## Stories'])],
    roles: ['human'],
    checks: ['secretScan'],
  },
  G3: {
    artifacts: [
      md('quality/test-strategy.md', ['## Strategy']),
      md('release/readiness.md', ['## Readiness']),
      md('release/release-notes.md', ['## Notes']),
      md('build/*/review.md', ['## Verdict']),
    ],
    roles: ['po', 'tech-lead', 'architect', 'sre', 'human'],
    checks: ['test', 'coverage', 'lint', 'build', 'secretScan'],
  },
  G4: {
    artifacts: [
      md('operations/slos.md', ['## SLOs']),
      md('operations/runbooks/*.md', []),
      md('operations/alerts/*', []),
      md('operations/load-test.md', ['## Load test']),
    ],
    roles: ['sre'],
    checks: ['secretScan', 'load'],
  },
};

const OPTIONAL_CHECKS = new Set(['a11y', 'load']);

async function walk(root, dir = '') {
  const out = [];
  let entries;
  try {
    entries = await readdir(join(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(root, rel)));
    else out.push(rel);
  }
  return out;
}

export async function expandArtifacts(root, pattern) {
  const base = agileDir(root);
  if (!pattern.includes('*')) return [pattern];
  const all = await walk(base);
  const re = globToRegExp(pattern);
  return all.filter((rel) => re.test(rel));
}

export async function validateArtifacts(root, artifacts) {
  const failures = [];
  const base = agileDir(root);
  for (const artifact of artifacts) {
    const matches = await expandArtifacts(root, artifact.path);
    if (matches.length === 0) {
      failures.push(`missing artifact: docs/agile/${artifact.path}`);
      continue;
    }
    for (const rel of matches) {
      let text;
      try {
        text = await readFile(join(base, rel), 'utf8');
      } catch {
        failures.push(`unreadable artifact: docs/agile/${rel}`);
        continue;
      }
      if (rel.endsWith('.json')) {
        try {
          JSON.parse(text);
        } catch {
          failures.push(`invalid JSON: docs/agile/${rel}`);
        }
        continue;
      }
      if (text.trim().length === 0) {
        failures.push(`empty artifact: docs/agile/${rel}`);
        continue;
      }
      for (const heading of artifact.headings) {
        if (!text.includes(heading)) failures.push(`missing heading "${heading}" in docs/agile/${rel}`);
      }
    }
  }
  return failures;
}

export async function loadProfile(root) {
  try {
    return parseProfile(await readFile(join(agileDir(root), 'stack-profile.md'), 'utf8'));
  } catch {
    return null;
  }
}

function runCommand(root, command) {
  return new Promise((resolve) => {
    execFile('sh', ['-c', command], { cwd: root, timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = `${stdout}${stderr}`.trim();
      if (!err) return resolve({ ok: true, detail: 'ok' });
      const reason = err.killed ? 'timed out' : err.code === 'ENOENT' ? 'command not found' : `exit ${err.code}`;
      resolve({ ok: false, detail: `${reason}: ${command}${output ? ` :: ${output.slice(-500)}` : ''}` });
    });
  });
}

export async function runChecks(root, profile, names = ['test', 'coverage', 'lint', 'build', 'secretScan']) {
  const results = [];
  if (!profile) {
    return { ok: false, results: [{ name: 'stack-profile', ok: false, detail: 'docs/agile/stack-profile.md not found or unreadable' }] };
  }
  for (const name of names) {
    const command = profile[name];
    if (!command) {
      if (OPTIONAL_CHECKS.has(name)) {
        results.push({ name, ok: true, detail: 'not applicable' });
        continue;
      }
      results.push({ name, ok: false, detail: `no ${name} command in stack profile` });
      continue;
    }
    const result = await runCommand(root, command);
    results.push({ name, ...result });
    if (!result.ok && name === 'test') break;
  }
  return { ok: results.every((r) => r.ok), results };
}

function roleForArtifact(path) {
  for (const [role, scopes] of Object.entries(ROLE_SCOPE)) {
    if (scopes.some((glob) => globToRegExp(glob).test(`docs/agile/${path}`))) return role;
  }
  return null;
}

export async function checkGate(root, gate) {
  const def = GATE_DEFS[gate];
  if (!def) return { ok: false, failures: [`unknown gate: ${gate}`] };
  const state = await loadState(root);
  const failures = [];

  failures.push(...(await validateArtifacts(root, def.artifacts)));

  const profile = await loadProfile(root);
  const checks = await runChecks(root, profile, def.checks);
  for (const result of checks.results) {
    if (!result.ok) failures.push(`check ${result.name}: ${result.detail}`);
  }

  const authors = {};
  for (const artifact of def.artifacts) {
    const role = roleForArtifact(artifact.path.replace(/\*.*$/, ''));
    if (role) authors[`docs/agile/${artifact.path}`] = role;
  }
  const waivers = activeWaivers(state);
  const reviews = await validateReviews(root, gate, def.roles, authors, waivers);
  failures.push(...reviews.failures);

  const boundary = await checkBoundary(root, state.writeScope, state.stageBase);
  if (!boundary.ok) {
    failures.push(boundary.reason ?? `boundary violation: ${boundary.violations.join(', ')}`);
  }

  const waived = failures.filter((f) => waiverCovers(waivers, gate, f));
  const blocking = failures.filter((f) => !waiverCovers(waivers, gate, f));

  if (blocking.length > 0) {
    state.gateRetries[gate] = (state.gateRetries[gate] ?? 0) + 1;
    if (state.gateRetries[gate] >= 2 && !state.escalation) {
      state.escalation = {
        reason: 'gate-failed-twice',
        question: `${gate} failed twice; first failure: ${failures[0]}`,
        blockedPhase: state.phase,
        at: new Date().toISOString(),
      };
    }
    await saveState(root, state);
    return { ok: false, failures: blocking };
  }

  state.gates[gate] = { status: 'pass', at: new Date().toISOString() };
  state.gateRetries[gate] = 0;
  await saveState(root, state);
  return { ok: true, failures: [], waived };
}
