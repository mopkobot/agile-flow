export const PHASES = [
  'intake',
  'discovery',
  'shaping',
  'ux',
  'architecture',
  'planning',
  'build',
  'quality',
  'release',
  'operations',
  'retro',
];

export const PHASE_ROLE = {
  intake: 'agile-flow',
  discovery: 'agile-po',
  shaping: 'agile-ba',
  ux: 'agile-ux',
  architecture: 'agile-architect',
  planning: 'agile-flow',
  build: 'agile-dev',
  quality: 'agile-qa',
  release: 'agile-flow',
  operations: 'agile-sre',
  retro: 'agile-flow',
};

export const GATE_AFTER = {
  intake: null,
  discovery: 'G0',
  shaping: null,
  ux: null,
  architecture: 'G1',
  planning: 'G2',
  build: null,
  quality: null,
  release: 'G3',
  operations: 'G4',
  retro: null,
};

export const PHASE_INPUTS = {
  intake: ['docs/agile/stack-profile.md'],
  discovery: ['docs/agile/stack-profile.md'],
  shaping: ['docs/agile/backlog.md', 'docs/agile/personas.md'],
  ux: ['docs/agile/stories/'],
  architecture: ['docs/agile/stories/', 'docs/agile/ux/flows.md'],
  planning: ['docs/agile/architecture/system.md', 'docs/agile/architecture/nfrs.md'],
  build: ['docs/agile/plan/'],
  quality: ['docs/agile/build/'],
  release: ['docs/agile/quality/test-strategy.md'],
  operations: ['docs/agile/release/readiness.md'],
  retro: ['docs/agile/state.json'],
};

export function nextAction(state) {
  const gate = GATE_AFTER[state.phase] ?? null;
  let blocked = null;
  if (state.escalation) {
    blocked = `escalation: ${state.escalation.reason}`;
  } else if (gate && state.gates?.[gate]?.status !== 'pass') {
    blocked = `gate ${gate} is ${state.gates?.[gate]?.status ?? 'locked'}`;
  }
  return {
    phase: state.phase,
    role: PHASE_ROLE[state.phase] ?? 'agile-flow',
    gate,
    inputs: PHASE_INPUTS[state.phase] ?? [],
    blocked,
  };
}

export function nextPhase(phase) {
  const i = PHASES.indexOf(phase);
  return i === -1 || i === PHASES.length - 1 ? null : PHASES[i + 1];
}
