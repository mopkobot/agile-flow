import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { initFlow, loadState, saveState, StateError, GATES, agileDir } from './state.mjs';
import { detectStack, renderProfile } from './stack.mjs';
import { nextAction, nextPhase, PHASES, GATE_AFTER } from './phases.mjs';
import { recordReview, ReviewError } from './reviews.mjs';
import { ROLE_SCOPE, checkBoundary, ignoredPaths, dorSignerScopes } from './boundary.mjs';
import { checkGate, checkStoryReady } from './gates.mjs';
import { addWaiver, WaiverError } from './waivers.mjs';
import { validateSkillTree } from './skills.mjs';
import { detectHarness } from './harness.mjs';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function headSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

let runEnv = process.env;

export async function run(argv, cwd = process.cwd(), options = {}) {
  runEnv = options.env ?? process.env;
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'init':
        return await cmdInit(rest, cwd);
      case 'status':
        return await cmdStatus(cwd);
      case 'next':
        return await cmdNext(cwd);
      case 'resume':
        return await cmdResume(rest, cwd);
      case 'sign':
        return await cmdSign(rest, cwd);
      case 'check':
        return await cmdCheck(rest, cwd);
      case 'waive':
        return await cmdWaive(rest, cwd);
      case 'skills':
        return cmdSkills(cwd, rest);
      case 'advance':
        return await cmdAdvance(rest, cwd);
      case 'guard':
        return await cmdGuard(rest, cwd);
      case 'setup-human':
        return await cmdSetupHuman(cwd);
      case 'story':
        return await cmdStory(rest, cwd);
      case 'tracker':
        return await cmdTracker(rest, cwd);
      case 'audit':
        return await cmdAudit(rest, cwd);
      case 'harness':
        return cmdHarness(cwd);
      case 'identity':
        return await cmdIdentity(rest, cwd);
      default:
        return usage();
    }
  } catch (err) {
    if (err instanceof StateError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

async function cmdInit(args, cwd) {
  const mode = flag(args, 'mode');
  const root = resolve(cwd, flag(args, 'repo') ?? '.');
  const { created, state } = await initFlow(root, mode);
  if (!created) {
    console.error(`error: ${state.targetRepo} already initialized`);
    return 2;
  }
  const stack = detectStack(root);
  state.stackDetected = Boolean(stack);
  await saveState(root, state);
  if (stack) {
    await writeFile(join(agileDir(root), 'stack-profile.md'), renderProfile(stack), 'utf8');
  } else {
    console.log('stack not detected: ask the operator for the stack and write docs/agile/stack-profile.md before G0');
  }
  console.log(`initialized ${mode} flow at ${root}`);
  return 0;
}

async function cmdStatus(cwd) {
  const state = await loadState(cwd);
  console.log(`phase: ${state.phase}`);
  console.log(`mode: ${state.mode}`);
  console.log(`sprint: ${state.sprint}`);
  console.log(`role: ${state.activeRole}`);
  for (const gate of GATES) {
    console.log(`${gate} ${state.gates[gate].status}`);
  }
  const now = new Date().toISOString().slice(0, 10);
  const active = state.waivers.filter((w) => w.expires >= now);
  for (const w of active) console.log(`waiver: ${w.gate} ${w.requirement} until ${w.expires}`);
  for (const [id, story] of Object.entries(state.stories ?? {})) {
    console.log(`${id} dor ${story.dor ?? 'pending'} dod ${story.dod ?? 'pending'}`);
  }
  if (state.escalation) {
    console.log(`escalation: ${state.escalation.reason}`);
    console.log(`question: ${state.escalation.question}`);
  }
  const blocked = [];
  if (state.escalation) blocked.push('escalation open; run "agile-flow resume --note <resolution>"');
  if (!state.stageBase) blocked.push('no stage base; run "agile-flow next"');
  if (blocked.length) console.log(`blocked: ${blocked.join('; ')}`);
  return 0;
}

async function cmdNext(cwd) {
  const state = await loadState(cwd);
  const action = nextAction(state);
  if (!action.blocked) {
    if (!state.stageBase || state.activeRole !== action.role) {
      state.stageBase = headSha(cwd);
      state.stageIgnored = ignoredPaths(cwd);
    }
    state.activeRole = action.role;
    state.writeScope = ROLE_SCOPE[action.role] ?? [];
    await saveState(cwd, state);
  }
  console.log(`phase: ${action.phase}`);
  console.log(`role: ${action.role}`);
  console.log(`gate: ${action.gate ?? 'none'}`);
  const today = new Date().toISOString().slice(0, 10);
  const gateWaivers = (state.waivers ?? []).filter(
    (w) => w.expires >= today && (!action.gate || w.gate === action.gate),
  );
  for (const waiver of gateWaivers) {
    console.log(`waiver: ${waiver.gate} ${waiver.requirement} until ${waiver.expires}`);
  }
  for (const input of action.inputs) console.log(`input: ${input}`);
  if (action.blocked) {
    console.log(`blocked: ${action.blocked}`);
    return 3;
  }
  return 0;
}

async function cmdResume(args, cwd) {
  const note = flag(args, 'note');
  const agent = flag(args, 'agent');
  const state = await loadState(cwd);
  if (!note || !note.trim()) {
    console.error('error: resume requires --note with the human resolution');
    return 1;
  }
  if (!state.escalation) {
    console.error('error: no escalation to resume from');
    return 1;
  }
  state.escalation = null;
  state.lastResolution = { note, at: new Date().toISOString() };
  await saveState(cwd, state);
  console.log('escalation cleared');
  return 0;
}

async function cmdSign(args, cwd) {
  const gate = args[0];
  const state = await loadState(cwd);
  const roleForAuth = flag(args, 'role');
  if (roleForAuth === 'human') {
    if (!(await humanApproved(state))) return 1;
  }
  const role = flag(args, 'role');
  const verdict = flag(args, 'verdict');
  const evidence = flag(args, 'evidence');
  const note = flag(args, 'note');
  const agent = flag(args, 'agent');
  if (role === 'human' && !note) {
    console.error('error: a human sign-off requires --note with the decision the human supplied');
    return 1;
  }
  if (!gate || !role || !verdict || !evidence) {
    console.error('usage: agile-flow sign <gate> --role <role> --verdict <pass|fail|pass-with-risk> --evidence <path[,path]>');
    return 1;
  }
  const paths = evidence.split(',').map((p) => p.trim()).filter(Boolean);
  if (roleForAuth !== 'human') {
    const { verifyRoleToken, ROLE_TOKEN_ENV } = await import('./identity.mjs');
    const check = await verifyRoleToken(cwd, roleForAuth, process.env[ROLE_TOKEN_ENV]);
    if (!check.ok) {
      console.error(`error: ${check.reason}`);
      return 1;
    }
  }
  try {
    const path = await recordReview(cwd, { gate, role, verdict, evidence: paths, note, agent });
    console.log(`signed ${gate} as ${role}: ${path}`);
    return 0;
  } catch (err) {
    if (err instanceof ReviewError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

async function cmdCheck(args, cwd) {
  const gate = args[0];
  if (!gate) {
    console.error('usage: agile-flow check <gate>');
    return 1;
  }
  const result = gate.startsWith('DoR-')
    ? await checkStoryReady(cwd, gate.slice(4))
    : await checkGate(cwd, gate);
  if (result.ok) {
    console.log(`${gate} pass`);
    for (const waived of result.waived ?? []) console.log(`waived: ${waived}`);
    return 0;
  }
  console.error(`${gate} fail`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  return 1;
}

async function cmdWaive(args, cwd) {
  const gate = args[0];
  const requirement = flag(args, 'requirement') ?? 'gate';
  const reason = flag(args, 'reason');
  const expires = flag(args, 'expires');
  const approver = flag(args, 'approver');
  if (!gate || !reason || !expires || !approver) {
    console.error('usage: agile-flow waive <gate> [--requirement <text>] --reason <text> --expires YYYY-MM-DD --approver human');
    return 1;
  }
  try {
    await addWaiver(cwd, { gate, requirement, reason, expires, approver });
    console.log(`waived ${gate} (${requirement}) until ${expires}`);
    return 0;
  } catch (err) {
    if (err instanceof WaiverError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

const GUARDED_ACTIONS = ['push', 'force-push', 'deploy', 'migrate', 'rotate-secret', 'delete-data'];

async function cmdGuard(args, cwd) {
  const action = args[0];
  const question = flag(args, 'question');
  if (!GUARDED_ACTIONS.includes(action)) {
    console.error(`error: guard action must be one of: ${GUARDED_ACTIONS.join(', ')}`);
    return 1;
  }
  if (!question || !question.trim()) {
    console.error('error: guard requires --question describing the irreversible effect');
    return 1;
  }
  const state = await loadState(cwd);
  state.escalation = {
    reason: 'destructive-action',
    action,
    question: question.trim(),
    blockedPhase: state.phase,
    at: new Date().toISOString(),
  };
  await saveState(cwd, state);
  console.error(`blocked: ${action} needs human approval`);
  console.error(`question: ${question.trim()}`);
  return 1;
}

function cmdHarness(cwd) {
  const result = detectHarness(cwd);
  for (const item of result.present) console.log(`present: ${item}`);
  for (const gap of result.fixes) {
    console.log(`missing: ${gap.gap}`);
    console.log(`  fix: ${gap.fix}`);
  }
  if (result.missing.length === 0) {
    console.log('harness complete');
    return 0;
  }
  console.log(`harness gaps: ${result.missing.length}`);
  return 1;
}

async function cmdAudit(args, cwd) {
  const sub = args[0];
  const { listClaims, recordAudit } = await import('./audit.mjs');
  if (sub === 'sample') {
    const count = Number(flag(args, 'count') ?? 5);
    const claims = await listClaims(cwd, count);
    if (claims.length === 0) {
      console.error('error: no citable claims found');
      return 1;
    }
    for (const claim of claims) console.log(claim);
    return 0;
  }
  if (sub === 'record') {
    const gate = flag(args, 'gate');
    const verdict = flag(args, 'verdict');
    const checked = Number(flag(args, 'checked'));
    const note = flag(args, 'note');
  const agent = flag(args, 'agent');
    if (!gate || !verdict || !note) {
      console.error('usage: agile-flow audit record --gate <gate> --verdict pass|fail --checked <n> --note <text>');
      return 1;
    }
    try {
      await recordAudit(cwd, { gate, verdict, checked, note, agent: flag(args, 'agent') });
      console.log(`audit recorded for ${gate}`);
      return 0;
    } catch (err) {
      console.error(`error: ${err.message}`);
      return 1;
    }
  }
  console.error('usage: agile-flow audit <sample|record> [options]');
  return 1;
}

async function cmdIdentity(args, cwd) {
  const sub = args[0];
  const role = flag(args, 'role');
  const { issueRoleToken, IdentityError } = await import('./identity.mjs');
  if (sub !== 'issue' || !role) {
    console.error('usage: agile-flow identity issue --role <role>');
    return 1;
  }
  const state = await loadState(cwd);
  if (!(await humanApproved(state))) return 1;
  try {
    const token = await issueRoleToken(cwd, role);
    console.log(token);
    return 0;
  } catch (err) {
    if (err instanceof IdentityError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

async function humanApproved(state) {
  const { verifyPassphrase, resolvePassphrase } = await import('./auth.mjs');
  if (!state.humanAuth) {
    console.error('error: no human passphrase configured; run "agile-flow setup-human"');
    return false;
  }
  const passphrase = await resolvePassphrase('Human passphrase: ');
  if (!passphrase) {
    console.error('error: passphrase required; set AGILE_HUMAN_PASSPHRASE or run in an interactive terminal');
    return false;
  }
  if (!verifyPassphrase(passphrase, state.humanAuth)) {
    console.error('error: human passphrase rejected');
    return false;
  }
  return true;
}

async function cmdStory(args, cwd) {
  const [id, status] = args;
  const role = flag(args, 'role');
  const agent = flag(args, 'agent');
  if (!id || !status || !role) {
    console.error('usage: agile-flow story <id> <in-dev|in-qa|done> --role <role> [--agent <name>]');
    return 1;
  }
  const { setStoryStatus, StoryError } = await import('./stories.mjs');
  try {
    const story = await setStoryStatus(cwd, id, status, role, agent);
    console.log(`${id} ${story.status} (${story.owner})`);
    return 0;
  } catch (err) {
    if (err instanceof StoryError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

async function cmdTracker(args, cwd) {
  const sub = args[0];
  if (sub !== 'sync') {
    console.error('usage: agile-flow tracker sync [--dry-run]');
    return 1;
  }
  const { syncGitHub, TrackerError } = await import('./tracker.mjs');
  try {
    await syncGitHub(cwd, { dryRun: args.includes('--dry-run'), env: runEnv });
    return 0;
  } catch (err) {
    if (err instanceof TrackerError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

async function cmdSetupHuman(cwd) {
  const state = await loadState(cwd);
  const { resolvePassphrase, hashPassphrase } = await import('./auth.mjs');
  const passphrase = await resolvePassphrase('New human passphrase (min 8 chars): ');
  if (!passphrase) {
    console.error('error: no passphrase supplied; set AGILE_HUMAN_PASSPHRASE or run in an interactive terminal');
    return 1;
  }
  state.humanAuth = hashPassphrase(passphrase);
  await saveState(cwd, state);
  console.log('human passphrase configured');
  return 0;
}

async function cmdAdvance(args, cwd) {
  const state = await loadState(cwd);
  if (state.escalation) {
    console.error(`error: escalation open (${state.escalation.reason}); resolve it before advancing`);
    return 1;
  }
  const gate = GATE_AFTER[state.phase];
  if (gate) {
    if (state.gates[gate]?.status !== 'pass') {
      console.error(`error: ${gate} has not passed; cannot leave ${state.phase}`);
      return 1;
    }
    const revalidated = await checkGate(cwd, gate);
    if (!revalidated.ok) {
      console.error(`error: ${gate} no longer verifies; cannot leave ${state.phase}`);
      for (const failure of revalidated.failures) console.error(`- ${failure}`);
      return 1;
    }
  } else if (state.stageBase) {
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const reviewFiles = await readdir(join(cwd, 'docs/agile/reviews')).catch(() => []);
    const allowed = [
      ...(state.writeScope ?? []),
      ...ROLE_SCOPE['agile-flow'],
      ...ROLE_SCOPE.human,
      ...dorSignerScopes(reviewFiles).flatMap((role) => ROLE_SCOPE[role] ?? []),
    ];
    const boundary = await checkBoundary(cwd, allowed, state.stageBase, state.stageIgnored ?? []);
    if (!boundary.ok) {
      console.error('error: phase boundary violated');
      if (boundary.reason) console.error(`- ${boundary.reason}`);
      for (const violation of boundary.violations ?? []) console.error(`- ${violation}`);
      return 1;
    }
  }

  const current = await loadState(cwd);
  const target = current.phase === 'retro' ? 'shaping' : flag(args, 'phase') ?? nextPhase(current.phase);
  if (!target) {
    console.error('error: already at the final phase');
    return 1;
  }
  if (current.phase === 'retro') {
    current.sprint += 1;
  }
  if (!PHASES.includes(target)) {
    console.error(`error: unknown phase: ${target}`);
    return 1;
  }
  current.phase = target;
  current.stageBase = null;
  await saveState(cwd, current);
  console.log(`phase: ${target}`);
  return 0;
}

function cmdSkills(cwd, args = []) {
  const root = resolve(cwd, flag(args, 'dir') ?? 'skills');
  const result = validateSkillTree(root);
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  if (result.ok) console.log(`ok ${readdirSync(root).filter((n) => n.startsWith('agile-')).length} skills`);
  return result.ok ? 0 : 1;
}

function usage() {
  console.error('usage: agile-flow <init|status|next|advance|guard|resume|sign|check|waive|skills|setup-human|identity|story|tracker|audit|harness> [options]');
  return 1;
}

export { saveState };
