import { execFileSync } from 'node:child_process';

export const ROLE_SCOPE = {
  'agile-flow': ['docs/agile/state.json', 'docs/agile/reviews/**', 'docs/agile/retro/**', 'docs/agile/waivers/**'],
  'agile-po': [
    'docs/agile/vision.md',
    'docs/agile/personas.md',
    'docs/agile/success-metrics.md',
    'docs/agile/backlog.md',
    'docs/agile/reviews/G3-po.yaml',
  ],
  'agile-ba': ['docs/agile/stories/**', 'docs/agile/refinements/**', 'docs/agile/reviews/DoR-*.yaml'],
  'agile-ux': [
    'docs/agile/ux/**',
    'docs/agile/reviews/G1-ux.yaml',
  ],
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
  ],
  'agile-dev': ['src/**', 'test/**', 'app/**', 'lib/**', 'package.json', 'docs/agile/build/**', 'Dockerfile', '.github/**', 'infra/**'],
  'agile-qa': ['docs/agile/quality/**', 'docs/agile/build/**/qa.md', 'test/e2e/**'],
  'agile-sre': [
    'docs/agile/operations/**',
    'docs/agile/reviews/G3-sre.yaml',
    'docs/agile/reviews/G4-sre.yaml',
    'infra/observability/**',
  ],
};

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  } catch {
    return '';
  }
}

export async function changedPaths(root, stageBase) {
  const output = [
    git(root, ['diff', '--name-only', stageBase]),
    git(root, ['ls-files', '--others', '--exclude-standard']),
    git(root, ['ls-files', '--others', '--ignored', '--exclude-standard']),
  ].join('\n');
  const paths = output
    .split('\n')
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

export async function checkBoundary(root, writeScope, stageBase) {
  if (!stageBase) {
    return { ok: false, violations: [], reason: 'no stage base recorded; refusing boundary check' };
  }
  const paths = await changedPaths(root, stageBase);
  const violations = paths.filter((path) => !matchesScope(path, writeScope));
  return { ok: violations.length === 0, violations, reason: null };
}
