import { accessSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_SCAN = `git rev-parse --git-dir >/dev/null 2>&1 || exit 1; ! git grep -qEI 'AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH )?PRIVATE KEY' -- .`;

const DETECTORS = [
  {
    manifest: 'package.json',
    language: 'node',
    commands(root) {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const s = pkg.scripts ?? {};
      return {
        test: s.test ? 'npm test' : 'node --test',
        coverage: s.coverage ? 'npm run coverage' : null,
        lint: s.lint ? 'npm run lint' : null,
        build: s.build ? 'npm run build' : null,
        load: s.load ? 'npm run load' : null,
        a11y: s.a11y ? 'npm run a11y' : null,
      };
    },
  },
  {
    manifest: 'pyproject.toml',
    language: 'python',
    commands: () => ({
      test: 'pytest',
      coverage: 'pytest --cov --cov-fail-under=80',
      lint: 'ruff check .',
      build: null,
    }),
  },
  {
    manifest: 'go.mod',
    language: 'go',
    commands: () => ({
      test: 'go test ./...',
      coverage: 'go test -coverprofile=coverage.out ./...',
      lint: 'go vet ./...',
      build: 'go build ./...',
    }),
  },
  {
    manifest: 'Cargo.toml',
    language: 'rust',
    commands: () => ({
      test: 'cargo test',
      coverage: 'cargo tarpaulin --fail-under 80',
      lint: 'cargo clippy -- -D warnings',
      build: 'cargo build',
    }),
  },
  {
    manifest: 'pom.xml',
    language: 'java',
    commands: () => ({ test: 'mvn test', coverage: 'mvn verify', lint: null, build: 'mvn package -DskipTests' }),
  },
  {
    manifest: 'Gemfile',
    language: 'ruby',
    commands: () => ({ test: 'bundle exec rspec', coverage: null, lint: 'bundle exec rubocop', build: null }),
  },
];

export function detectStack(root) {
  for (const detector of DETECTORS) {
    if (!existsSync(join(root, detector.manifest))) continue;
    let commands;
    try {
      commands = detector.commands(root);
    } catch {
      return null;
    }
    return {
      language: detector.language,
      manifest: detector.manifest,
      test: commands.test,
      coverage: commands.coverage ?? null,
      lint: commands.lint ?? null,
      build: commands.build ?? null,
      secretScan: SECRET_SCAN,
      a11y: commands.a11y ?? null,
      load: commands.load ?? null,
    };
  }
  return null;
}

const FIELDS = ['language', 'manifest', 'test', 'coverage', 'lint', 'build', 'secretScan', 'a11y', 'load'];

export function renderProfile(profile) {
  const rows = FIELDS.map((key) => {
    const value = profile[key];
    return `| ${key} | ${value === null || value === undefined ? 'not applicable' : value} |`;
  });
  return ['# Stack Profile', '', '| field | value |', '|---|---|', ...rows, ''].join('\n');
}

export function parseProfile(md) {
  const out = {};
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*(\w+)\s*\|\s*(.*?)\s*\|$/);
    if (!m || m[1] === 'field') continue;
    out[m[1]] = m[2] === 'not applicable' ? null : m[2];
  }
  return out;
}

export { SECRET_SCAN };
