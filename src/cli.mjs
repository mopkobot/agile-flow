import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { initFlow, loadState, saveState, StateError, GATES, agileDir } from './state.mjs';
import { detectStack, renderProfile } from './stack.mjs';
import { nextAction } from './phases.mjs';
import { recordReview, ReviewError } from './reviews.mjs';
import { ROLE_SCOPE } from './boundary.mjs';
import { checkGate } from './gates.mjs';
import { addWaiver, WaiverError } from './waivers.mjs';
import { validateSkillTree } from './skills.mjs';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function headSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export async function run(argv, cwd = process.cwd()) {
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
    if (!state.stageBase) state.stageBase = headSha(cwd);
    state.activeRole = action.role;
    state.writeScope = ROLE_SCOPE[action.role] ?? [];
    await saveState(cwd, state);
  }
  console.log(`phase: ${action.phase}`);
  console.log(`role: ${action.role}`);
  console.log(`gate: ${action.gate ?? 'none'}`);
  for (const input of action.inputs) console.log(`input: ${input}`);
  if (action.blocked) {
    console.log(`blocked: ${action.blocked}`);
    return 3;
  }
  return 0;
}

async function cmdResume(args, cwd) {
  const note = flag(args, 'note');
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
  const role = flag(args, 'role');
  const verdict = flag(args, 'verdict');
  const evidence = flag(args, 'evidence');
  if (!gate || !role || !verdict || !evidence) {
    console.error('usage: agile-flow sign <gate> --role <role> --verdict <pass|fail|pass-with-risk> --evidence <path[,path]>');
    return 1;
  }
  const paths = evidence.split(',').map((p) => p.trim()).filter(Boolean);
  try {
    const path = await recordReview(cwd, { gate, role, verdict, evidence: paths });
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
  const result = await checkGate(cwd, gate);
  if (result.ok) {
    console.log(`${gate} pass`);
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

function cmdSkills(cwd, args = []) {
  const root = resolve(cwd, flag(args, 'dir') ?? 'skills');
  const result = validateSkillTree(root);
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  if (result.ok) console.log(`ok ${readdirSync(root).filter((n) => n.startsWith('agile-')).length} skills`);
  return result.ok ? 0 : 1;
}

function usage() {
  console.error('usage: agile-flow <init|status|next|resume|sign|check|waive|skills> [options]');
  return 1;
}

export { saveState };
