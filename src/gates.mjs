import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agileDir, loadState, saveState } from './state.mjs';
import { globToRegExp, ROLE_SCOPE, checkBoundary, changedPaths } from './boundary.mjs';
import { parseProfile } from './stack.mjs';
import { readReviews, validateReviews } from './reviews.mjs';
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
      md('architecture/threat-model.md', ['## Assets', '## Trust boundaries', '## Threats']),
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
      md('build/*/red.log', []),
      md('build/*/green.log', []),
      md('build/*/refactor.log', []),
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

const OPTIONAL_CHECKS = new Set(['a11y']);

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

function sectionBody(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return '';
  const after = text.slice(start + heading.length);
  const next = after.search(/\n## /);
  return (next === -1 ? after : after.slice(0, next)).trim();
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
        if (!text.includes(heading)) {
          failures.push(`missing heading "${heading}" in docs/agile/${rel}`);
          continue;
        }
        const body = sectionBody(text, heading);
        if (body.length === 0) failures.push(`empty section "${heading}" in docs/agile/${rel}`);
        else if (/^(todo|tbd|placeholder|n\/a)/i.test(body)) {
          failures.push(`placeholder section "${heading}" in docs/agile/${rel}`);
        }
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

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

function runCommand(root, command) {
  return new Promise((resolve) => {
    execFile('sh', ['-c', command], { cwd: root, env: cleanEnv(), timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = `${stdout}${stderr}`.trim();
      if (!err) return resolve({ ok: true, detail: 'ok', output });
      const reason = err.killed ? 'timed out' : err.code === 'ENOENT' ? 'command not found' : `exit ${err.code}`;
      resolve({ ok: false, detail: `${reason}: ${command}${output ? ` :: ${output.slice(-500)}` : ''}` });
    });
  });
}

export function changedCoveragePercent(output, changedFiles = []) {
  if (changedFiles.length === 0) return null;
  const rows = output.split('\n').filter((l) => /\|/.test(l) && /\d/.test(l));
  const parsed = new Map();
  for (const row of rows) {
    const cells = row.replace(/^#\s*/, '').split('|').map((c) => c.trim());
    const file = cells[0];
    const pct = Number(cells[1]);
    if (file && Number.isFinite(pct)) parsed.set(file.replace(/^\/.*?\/(?=src|app|lib|test)/, ''), pct);
  }
  const values = changedFiles
    .map((f) => parsed.get(f))
    .filter((v) => v !== undefined);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export function coveragePercent(output) {
  const allLine = output.split('\n').find((line) => /all files/i.test(line));
  if (allLine) {
    const first = allLine.match(/all files\s*\|\s*(\d+(?:\.\d+)?)/i);
    if (first) return Number(first[1]);
  }
  const matches = [...output.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  return matches.length === 0 ? null : Math.min(...matches);
}

export async function validateTddEvidence(root) {
  const failures = [];
  const reds = await expandArtifacts(root, 'build/*/red.log');
  if (reds.length === 0) failures.push('missing TDD evidence: no build/*/red.log');
  for (const rel of reds) {
    const text = await readFile(join(agileDir(root), rel), 'utf8');
    const m = text.match(/#\s*fail\s+(\d+)/);
    if (!m) failures.push(`red.log has no failure count: docs/agile/${rel}`);
    else if (Number(m[1]) === 0) failures.push(`red.log shows zero failures: docs/agile/${rel}`);
  }
  const greens = await expandArtifacts(root, 'build/*/green.log');
  if (greens.length === 0) failures.push('missing TDD evidence: no build/*/green.log');
  for (const rel of greens) {
    const text = await readFile(join(agileDir(root), rel), 'utf8');
    if (!/#\s*fail\s+0/.test(text)) failures.push(`green.log does not show a clean run: docs/agile/${rel}`);
  }
  const refactors = await expandArtifacts(root, 'build/*/refactor.log');
  for (const rel of refactors) {
    const text = await readFile(join(agileDir(root), rel), 'utf8');
    const clean = /#\s*fail\s+0/.test(text);
    const reasoned = /^\s*no refactor\s*:/im.test(text);
    if (!clean && !reasoned) {
      failures.push(`refactor.log shows neither a clean run nor a reasoned "no refactor": docs/agile/${rel}`);
    }
  }
  const reviews = await expandArtifacts(root, 'build/*/review.md');
  for (const rel of reviews) {
    const text = await readFile(join(agileDir(root), rel), 'utf8');
    const body = sectionBody(text, '## Verdict');
    if (!/^pass\b/i.test(body)) failures.push(`review verdict is not pass: docs/agile/${rel}`);
    const reviewer = text.match(/^reviewer:\s*(\S+)/m)?.[1];
    const implementer = text.match(/^implementer:\s*(\S+)/m)?.[1];
    if (!reviewer) failures.push(`review names no reviewer: docs/agile/${rel}`);
    if (!implementer) failures.push(`review names no implementer: docs/agile/${rel}`);
    if (reviewer && implementer && reviewer === implementer) {
      failures.push(`reviewer and implementer are the same agent: docs/agile/${rel}`);
    }
  }
  return failures;
}

export async function runChecks(root, profile, names = ['test', 'coverage', 'lint', 'build', 'secretScan'], changedFiles = []) {
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
    if (result.ok && name === 'coverage') {
      if (/--check-coverage|--cov-fail-under|--fail-under/.test(command)) {
        results.push({ name, ok: true, detail: `threshold enforced by the command: ${command}` });
        continue;
      }
      const percent = changedCoveragePercent(result.output ?? '', changedFiles ?? []) ?? coveragePercent(result.output ?? '');
      if (percent === null) {
        results.push({ name, ok: false, detail: `coverage command reported no percentage and enforces no threshold: ${command} :: ${(result.output ?? '').slice(-300)}` });
        continue;
      }
      if (percent < 80) {
        results.push({ name, ok: false, detail: `coverage ${percent}% is below the 80% threshold: ${command}` });
        continue;
      }
    }
    results.push({ name, ...result });
    if (!result.ok && name === 'test') break;
  }
  return { ok: results.every((r) => r.ok), results };
}

export async function validateReviewClaims(root, rel) {
  const failures = [];
  const text = await readFile(join(agileDir(root), rel), 'utf8');
  const verdict = sectionBody(text, '## Verdict');
  const findings = sectionBody(text, '## Findings');
  const lines = findings.split('\n').filter((l) => /^-\s+/.test(l) && !/^-\s+none\s*$/i.test(l));

  if (/^fail/i.test(verdict) && lines.length === 0) {
    failures.push(`failing verdict needs a cited finding: docs/agile/${rel}`);
    return failures;
  }

  for (const line of lines) {
    const match = line.match(/([\w./-]+\.\w+):(\d+)/);
    if (!match) {
      failures.push(`finding lacks a path:line citation: docs/agile/${rel} :: ${line.trim()}`);
      continue;
    }
    const [, file, lineNumber] = match;
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      failures.push(`cited file does not exist: ${file} (docs/agile/${rel})`);
      continue;
    }
    const total = content.split('\n').length;
    if (Number(lineNumber) > total) {
      failures.push(`cited line ${lineNumber} is past end of ${file} (${total} lines) in docs/agile/${rel}`);
    }
  }
  return failures;
}

export async function validateQaEvidence(root, rel) {
  const text = await readFile(join(agileDir(root), rel), 'utf8');
  const hasCommand = /^\$\s+\S+/m.test(text);
  return hasCommand ? [] : [`qa evidence has no executed command: docs/agile/${rel}`];
}

export async function validateNfrMeasurements(root) {
  const failures = [];
  const text = await readFile(join(agileDir(root), 'architecture/nfrs.md'), 'utf8');
  const body = sectionBody(text, '## NFRs');
  const rows = body.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
  for (const row of rows.slice(1)) {
    const cells = row.split('|').map((c) => c.trim()).filter((c) => c !== '');
    if (cells.length < 4 || !cells[2]) {
      failures.push(`NFR row names no measurement: ${row.trim()}`);
    }
  }
  return failures;
}

const STORY_HEADINGS = [
  '## Story',
  '## Acceptance criteria',
  '## Non-goals',
  '## Test plan',
  '## Wireframe',
  '## NFRs',
  '## Open questions',
  '## Slice',
];

export async function checkStoryReady(root, storyId) {
  const failures = [];
  const storyRel = `stories/${storyId}.md`;
  let text;
  try {
    text = await readFile(join(agileDir(root), storyRel), 'utf8');
  } catch {
    return { ok: false, failures: [`missing story: docs/agile/${storyRel}`] };
  }

  for (const heading of STORY_HEADINGS) {
    if (!text.includes(heading)) failures.push(`story missing heading "${heading}"`);
  }
  if (!/^priority:[ \t]*\S+/m.test(text)) failures.push('story has no priority');
  if (/status:\s*open/i.test(sectionBody(text, '## Open questions'))) {
    failures.push('story has a blocking open question');
  }

  const wireframe = text.match(/docs\/agile\/ux\/wireframes\/[^\s)]+/)?.[0];
  if (!wireframe) {
    failures.push('story names no wireframe');
  } else {
    try {
      await readFile(join(agileDir(root), wireframe.replace('docs/agile/', '')), 'utf8');
    } catch {
      failures.push(`wireframe does not exist: ${wireframe}`);
    }
  }

  const state = await loadState(root);
  const reviews = await validateReviews(root, `DoR-${storyId}`, ['ba', 'ux', 'sre', 'tech-lead'], {}, activeWaivers(state));
  failures.push(...reviews.failures);

  state.stories[storyId] = {
    ...(state.stories[storyId] ?? {}),
    dor: failures.length === 0 ? 'pass' : 'pending',
    checkedAt: new Date().toISOString(),
  };
  await saveState(root, state);

  return { ok: failures.length === 0, failures };
}

export async function validateStoryLinkage(root, state) {
  const failures = [];
  const dirs = await walk(join(agileDir(root), 'build'));
  const ids = new Set(
    dirs
      .map((rel) => rel.split('/')[0])
      .filter((id) => id && id !== 'build'),
  );
  for (const id of ids) {
    const story = state.stories?.[id];
    if (!story || story.dor !== 'pass') {
      failures.push(`story ${id} has build artifacts but DoR never passed`);
    }
  }
  return failures;
}

export async function checkGate(root, gate) {
  const def = GATE_DEFS[gate];
  if (!def) return { ok: false, failures: [`unknown gate: ${gate}`] };
  const state = await loadState(root);
  const failures = [];

  failures.push(...(await validateArtifacts(root, def.artifacts)));
  if (gate === 'G2') {
    const { checkDebtAllocation } = await import('./debt.mjs');
    const percent = state.debtAllocation?.percent;
    if (percent === undefined || percent === null) {
      failures.push('no debt allocation configured; run "agile-flow debt set <percent>"');
    } else {
      const { checkPlanResolves } = await import('./debt.mjs');
      const planDir = join(agileDir(root), 'plan');
      const plans = (await readdir(planDir).catch(() => [])).filter((f) => /^sprint-.*\.md$/.test(f));
      const latest = plans.sort().pop();
      if (!latest) failures.push('no sprint plan to validate against the debt allocation');
      else {
        const planText = await readFile(join(planDir, latest), 'utf8');
        failures.push(...checkDebtAllocation(planText, percent));
        const backlog = await readFile(join(agileDir(root), 'backlog.md'), 'utf8').catch(() => '');
        const debt = await readFile(join(agileDir(root), 'architecture/debt.md'), 'utf8').catch(() => '');
        failures.push(...checkPlanResolves(planText, { backlog, debt }));
      }
    }
  }
  if (gate === 'G1') {
    failures.push(...(await validateNfrMeasurements(root)));
  }
  if (gate === 'G3') {
    const { checkDebtCompletion } = await import('./debt.mjs');
    const planDir = join(agileDir(root), 'plan');
    const latest = (await readdir(planDir).catch(() => [])).filter((f) => /^sprint-.*\.md$/.test(f)).sort().pop();
    if (latest) failures.push(...checkDebtCompletion(await readFile(join(planDir, latest), 'utf8'), state));
    failures.push(...(await validateTddEvidence(root)));
    failures.push(...(await validateStoryLinkage(root, state)));
    for (const rel of await expandArtifacts(root, 'build/*/review.md')) {
      failures.push(...(await validateReviewClaims(root, rel)));
    }
    const evidence = await expandArtifacts(root, 'quality/evidence/*.md');
    if (evidence.length === 0) failures.push('no QA evidence files under docs/agile/quality/evidence/');
    for (const rel of evidence) {
      failures.push(...(await validateQaEvidence(root, rel)));
    }
    const { validateAudit } = await import('./audit.mjs');
    if (!(await validateAudit(root, 'G3'))) failures.push('audit record missing for G3');
  }
  if (gate === 'G4') {
    const { validateAudit } = await import('./audit.mjs');
    if (!(await validateAudit(root, 'G4'))) failures.push('audit record missing for G4');
  }

  const profile = await loadProfile(root);
  const changed = state.stageBase ? await changedPaths(root, state.stageBase, state.stageIgnored ?? []) : [];
  const changedCode = changed.filter((p) => /\.(mjs|js|ts|tsx|jsx|py|go|rs|java|rb)$/.test(p));
  const checks = await runChecks(root, profile, def.checks, changedCode);
  for (const result of checks.results) {
    if (!result.ok) failures.push(`check ${result.name}: ${result.detail}`);
  }

  const waivers = activeWaivers(state);
  const reviews = await validateReviews(root, gate, def.roles, {}, waivers);
  failures.push(...reviews.failures);

  const signers = (await readReviews(root, gate)).map((r) => (r.role === 'human' ? 'human' : `agile-${r.role}`));
  const allowed = [
    ...(state.writeScope ?? []),
    ...ROLE_SCOPE['agile-flow'],
    ...ROLE_SCOPE.human,
    ...signers.flatMap((role) => ROLE_SCOPE[role] ?? []),
  ];
  const boundary = await checkBoundary(root, allowed, state.stageBase, state.stageIgnored ?? []);
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

  if (gate === 'G3') {
    const dirs = await walk(join(agileDir(root), 'build'));
    for (const id of new Set(dirs.map((rel) => rel.split('/')[0]).filter((id) => id !== 'build'))) {
      if (state.stories?.[id]) state.stories[id].dod = 'pass';
    }
  }

  state.gates[gate] = { status: 'pass', at: new Date().toISOString() };
  state.gateRetries[gate] = 0;
  await saveState(root, state);
  return { ok: true, failures: [], waived };
}
