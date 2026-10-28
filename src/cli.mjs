import { resolve } from 'node:path';
import { initFlow, loadState, saveState, StateError, GATES } from './state.mjs';

export async function run(argv, cwd = process.cwd()) {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'init':
        return await cmdInit(rest, cwd);
      case 'status':
        return await cmdStatus(cwd);
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

function usage() {
  console.error('usage: agile-flow <init|status> [options]');
  return 1;
}

export { saveState };
