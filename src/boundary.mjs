import { execFileSync } from 'node:child_process';


export const ROLE_SCOPE = {
  'agile-flow': [
    'docs/agile/state.json',
    'docs/agile/stack-profile.md',
    'docs/agile/reviews/**',
    'docs/agile/retro/**',
    'docs/agile/waivers/**',
    'docs/agile/plan/**',
    'docs/agile/release/**',
  ],
  human: ['docs/agile/reviews/*-human.yaml'],
  'agile-po': [
    'docs/agile/vision.md',
    'docs/agile/personas.md',
    'docs/agile/success-metrics.md',
    'docs/agile/backlog.md',
    'docs/agile/reviews/G0-po.yaml',
    'docs/agile/reviews/G3-po.yaml',
  ],
  'agile-ba': ['docs/agile/stories/**', 'docs/agile/refinements/**', 'docs/agile/reviews/DoR-*.yaml'],
  'agile-ux': ['docs/agile/ux/**', 'docs/agile/reviews/G1-ux.yaml', 'docs/agile/reviews/DoR-*-ux.yaml'],
  'agile-architect': [
    'docs/agile/architecture/**',
    'docs/agile/reviews/G1-architect.yaml',
    'docs/agile/reviews/G3-architect.yaml',
  ],
  'agile-tech-lead': [
    'docs/agile/architecture/debt.md',
    'docs/agile/build/**/plan.md',
    'docs/agile/build/**/review.md',
    'docs/agile/reviews/G1-tech-lead.yaml',
    'docs/agile/reviews/G3-tech-lead.yaml',
    'docs/agile/reviews/DoR-*-tech-lead.yaml',
  ],
  'agile-dev': [
    'src/**',
    'test/**',
    'app/**',
    'lib/**',
    'package.json',
    'docs/agile/build/**',
    'Dockerfile',
    '.github/**',
    'infra/**',
  ],
  'agile-qa': ['docs/agile/quality/**', 'docs/agile/build/**/qa.md'],
  'agile-sre': [
    'docs/agile/operations/**',
    'docs/agile/reviews/G3-sre.yaml',
    'docs/agile/reviews/G4-sre.yaml',
    'docs/agile/reviews/DoR-*-sre.yaml',
    'infra/observability/**',
  ],
};

function gitStrict(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

const IGNORED_EXCLUDES = ['node_modules/', '.git/', '.cache/', 'vendor/', 'target/', '.venv/', '__pycache__/', 'dist/', 'build/'];

export function ignoredPaths(root) {
  try {
    return gitStrict(root, ['ls-files', '--others', '--ignored', '--exclude-standard'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function changedPaths(root, stageBase, ignoredBaseline = []) {
  if (!stageBase) throw new Error('no stage base recorded');

  let tracked;
  try {
    tracked = gitStrict(root, ['diff', '--name-only', stageBase]);
  } catch {
    throw new Error(`cannot resolve stage base ${stageBase}`);
  }
  const untracked = gitStrict(root, ['ls-files', '--others', '--exclude-standard']);

  const baseline = new Set(ignoredBaseline);
  const freshIgnored = ignoredPaths(root).filter(
    (rel) => !baseline.has(rel) && !IGNORED_EXCLUDES.some((prefix) => rel.startsWith(prefix)),
  );

  const paths = [
    ...tracked.split('\n'),
    ...untracked.split('\n'),
    ...freshIgnored,
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  return [...new Set(paths)].sort();
}

export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else if ('\\^$+.()|{}[]'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesScope(path, globs) {
  return globs.some((glob) => globToRegExp(glob).test(path));
}

export async function checkBoundary(root, writeScope, stageBase, ignoredBaseline = []) {
  if (!stageBase) {
    return { ok: false, violations: [], reason: 'no stage base recorded; refusing boundary check' };
  }
  let paths;
  try {
    paths = await changedPaths(root, stageBase, ignoredBaseline);
  } catch (err) {
    return { ok: false, violations: [], reason: err.message };
  }
  const violations = paths.filter((path) => !matchesScope(path, writeScope));
  return { ok: violations.length === 0, violations, reason: null };
}

export function dorSignerScopes(reviewFiles) {
  const roles = new Set();
  for (const file of reviewFiles) {
    const match = file.match(/^DoR-.+-(ba|ux|sre|tech-lead)\.yaml$/);
    if (match) roles.add(`agile-${match[1]}`);
  }
  return [...roles];
}
