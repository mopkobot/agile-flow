import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHECKS = [
  {
    name: 'agent instructions',
    test: (root) => ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md'].some((f) => existsSync(join(root, f))),
    fix: 'Write AGENTS.md with build, test, and review rules the agent must follow.',
  },
  {
    name: 'test command',
    test: (root) => {
      try {
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        if (pkg.scripts?.test) return true;
      } catch {}
      return ['pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'Gemfile'].some((f) => existsSync(join(root, f)));
    },
    fix: 'Declare one command that runs the whole suite, and make it fast enough to run on every change.',
  },
  {
    name: 'CI pipeline',
    test: (root) => ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci'].some((f) => existsSync(join(root, f))),
    fix: 'Add a pipeline that runs tests, lint, and build on every push to trunk.',
  },
  {
    name: 'architecture context',
    test: (root) => ['docs/architecture.md', 'docs/agile/architecture/system.md', 'ARCHITECTURE.md'].some((f) => existsSync(join(root, f))),
    fix: 'Write a short system map: components, boundaries, data stores, and the decisions that are hard to reverse.',
  },
  {
    name: 'product context',
    test: (root) => ['docs/agile/vision.md', 'docs/product.md', 'README.md'].some((f) => existsSync(join(root, f))),
    fix: 'Write what the product is for, who uses it, and the three outcomes that matter this quarter.',
  },
  {
    name: 'reliability signals',
    test: (root) => ['ops/alerts.yaml', 'ops', 'docs/agile/operations/slos.md', 'grafana', 'prometheus'].some((f) => existsSync(join(root, f))),
    fix: 'Name the signals that say the system is healthy, and where they are emitted.',
  },
];

export function detectHarness(root) {
  const present = [];
  const missing = [];
  const fixes = [];
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.test(root);
    } catch {
      ok = false;
    }
    if (ok) present.push(check.name);
    else {
      missing.push(check.name);
      fixes.push({ gap: check.name, fix: check.fix });
    }
  }
  return { present, missing, fixes };
}

export function harnessFiles(root) {
  const dir = join(root, 'docs/agile');
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((f) => f === 'harness.md');
  } catch {
    return [];
  }
}
