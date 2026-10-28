# Agile Flow Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build nine self-contained OpenCode skills plus a zero-dependency Node CLI that runs a real agile delivery lifecycle with hard gates and enforced role boundaries.

**Architecture:** `agile-flow` is the only skill that spawns subagents; eight role skills each read and write a fixed set of artifact paths and record sign-offs. A Node CLI owns `docs/agile/state.json`, validates gate artifacts, runs the stack's executable checks, and rejects any write outside the active role's scope.

**Tech Stack:** Node 20+, `node:test`, `node:assert`, `node:child_process`, zero runtime dependencies. Markdown artifacts, YAML sign-off records, JSON state.

**Spec:** `docs/specs/2026-10-27-agile-skills-design.md`

## Global Constraints

- Node 20 or newer. No runtime dependencies in `package.json`.
- All artifacts in English, normal prose.
- `docs/agile/` is the only artifact root. Files are authoritative over chat.
- Gates are hard: `check` exit 0 is the only way a gate opens.
- Role boundaries are hard: no write outside `writeScope`, no self-approval.
- TDD enforced by separate test-author and implementer subagents, with `red.log` and `green.log` evidence.
- Changed-code coverage threshold: 80%.
- No estimation, no daily standup, Markdown-only tracker, flat subagent topology.
- CLI never edits product code and never commits.

## Review Focus

- A gate checked before any commit produces an empty `git diff`; boundary validation must compare against `stageBase`, not `HEAD`, or it passes vacuously.
- A stack profile naming a command that does not exist must fail the gate loudly, never be skipped as "not applicable".
- `state.json` deleted or corrupted mid-flow must make `resume` refuse; silently re-initializing would erase gate history.
- An expired waiver must close the gate again, and `status` must stop reporting the flow as waived.
- Untracked or gitignored files written outside a role's scope must still be detected as violations.

---

### Task 1: CLI skeleton, `init`, `status`

**Files:**
- Create: `package.json`, `bin/agile-flow.mjs`, `src/cli.mjs`, `src/state.mjs`
- Test: `test/cli-init.test.mjs`, `test/helpers.mjs` (helpers: `baseState`, `seededRepo`, `gitRepo`, `flowRepo`, `runningFlowRepo`, `waivedRepo`, `copyFixture`; add each helper in the task that first uses it)

**Interfaces:**
- Consumes: nothing.
- Produces: `STATE_PATH` (`'docs/agile/state.json'`), `loadState(root: string): State`, `saveState(root: string, state: State): void`, `initFlow(root: string, mode: 'greenfield'|'brownfield'): State`, `run(argv: string[], cwd: string): Promise<number>`.
- `State` shape is the spec's `state.json` example plus `stageBase: string|null`.

- [ ] **Step 1: Write the failing test**

```js
// test/cli-init.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';

test('init creates state and status prints the phase', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 0);
  const state = JSON.parse(await readFile(join(repo, 'docs/agile/state.json'), 'utf8'));
  assert.equal(state.phase, 'intake');
  assert.equal(state.gates.G0.status, 'locked');
  assert.equal(await run(['init', '--mode', 'greenfield', '--repo', repo], repo), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-init.test.mjs`
Expected: FAIL, cannot find module `../src/cli.mjs`

- [ ] **Step 3: Implement `run(argv, cwd): Promise<number>` in `src/cli.mjs` and `initFlow` in `src/state.mjs`**

Dispatch on `argv[0]`. `init` creates `docs/agile/`, writes state with `version: 1`, `sprint: 1`, `phase: 'intake'`, `activeRole: 'agile-flow'`, `writeScope: []`, `stageBase: null`, gates `G0..G4` all `{status:'locked', at:null}`, empty `stories`, `waivers`, `gateRetries: {}`, `escalation: null`. Second init exits 2. `bin/agile-flow.mjs` calls `run(process.argv.slice(2), process.cwd())` and exits with its return value.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli-init.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json bin src test
git commit -m "feat: add agile-flow cli skeleton with init and status"
```

---

### Task 2: Stack detection and profile

**Files:**
- Create: `src/stack.mjs`
- Modify: `src/cli.mjs` (`init` writes `docs/agile/stack-profile.md`)
- Test: `test/stack.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `detectStack(root: string): StackProfile | null`, `renderProfile(profile: StackProfile): string`, `parseProfile(md: string): StackProfile`.
- `StackProfile` = `{language: string, manifest: string, test: string, coverage: string, lint: string, build: string, secretScan: string, a11y: string|null, load: string|null}`.

- [ ] **Step 1: Write the failing test**

```js
test('detects node and round-trips the profile', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const p = detectStack(repo);
  assert.equal(p.language, 'node');
  assert.equal(parseProfile(renderProfile(p)).test, 'npm test');
});

test('returns null when nothing is detected', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'af-'));
  assert.equal(detectStack(repo), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/stack.test.mjs`
Expected: FAIL, cannot find module `../src/stack.mjs`

- [ ] **Step 3: Implement `detectStack` for `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`**

Each detector returns commands using that ecosystem's standard runner. Unknown layers get `null` and render as `not applicable: <reason>`; a null `test` or `lint` is not allowed. Render as a Markdown table under `## Commands` so `parseProfile` can read it back.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/stack.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: detect stack and write stack profile"
```

---

### Task 3: Phase machine, `next`, `resume`

**Files:**
- Create: `src/phases.mjs`
- Modify: `src/cli.mjs`
- Test: `test/phases.test.mjs`

**Interfaces:**
- Consumes: `loadState`, `saveState`.
- Produces: `PHASES: string[]`, `PHASE_ROLE: Record<string,string>`, `GATE_AFTER: Record<string,string|null>`, `nextAction(state: State): {phase, role, gate, inputs: string[], blocked: string|null}`.

- [ ] **Step 1: Write the failing test**

```js
test('next maps phase to role and blocks on escalation', () => {
  const s = baseState();
  assert.deepEqual(pick(nextAction(s)), { phase: 'intake', role: 'agile-flow', gate: null, blocked: null });
  s.escalation = { reason: 'gate-failed-twice', question: 'q', blockedPhase: 'build', at: 'x' };
  assert.equal(nextAction(s).blocked, 'escalation: gate-failed-twice');
});

test('resume refuses when state.json is corrupt', async () => {
  const repo = await seededRepo();
  await writeFile(join(repo, 'docs/agile/state.json'), '{ broken');
  assert.equal(await run(['resume', '--note', 'fixed'], repo), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/phases.test.mjs`
Expected: FAIL, cannot find module `../src/phases.mjs`

- [ ] **Step 3: Implement the phase table and `nextAction`**

`PHASE_ROLE`: intake `agile-flow`, discovery `agile-po`, shaping `agile-ba`, ux `agile-ux`, architecture `agile-architect`, planning `agile-flow`, build `agile-dev`, quality `agile-qa`, release `agile-flow`, operations `agile-sre`, retro `agile-flow`. `GATE_AFTER`: discovery `G0`, architecture `G1`, planning `G2`, release `G3`, operations `G4`, all others `null`. `resume` clears `escalation` only when `--note` is non-empty; otherwise exit 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/phases.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: add phase machine, next, and resume"
```

---

### Task 4: Sign-off records with self-approval rejection

**Files:**
- Create: `src/reviews.mjs`
- Modify: `src/cli.mjs` (`sign` command)
- Test: `test/reviews.test.mjs`

**Interfaces:**
- Consumes: `loadState`.
- Produces: `recordReview(root: string, r: ReviewInput): string` (returns written path), `readReviews(root: string, gate: string): ReviewRecord[]`, `validateReviews(root: string, gate: string, requiredRoles: string[], artifactAuthors: Record<string,string>): {ok: boolean, failures: string[]}`.
- `ReviewInput` = `{gate, role, verdict: 'pass'|'fail'|'pass-with-risk', evidence: string[]}`.

- [ ] **Step 1: Write the failing test**

```js
test('rejects evidence that does not exist', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['sign', 'G3', '--role', 'sre', '--verdict', 'pass', '--evidence', 'nope.md'], repo), 1);
});

test('rejects a role signing its own artifact', () => {
  const out = validateReviews(repo, 'G1', ['architect'], { 'docs/agile/architecture/system.md': 'architect' });
  assert.equal(out.ok, false);
  assert.match(out.failures[0], /self-approval/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/reviews.test.mjs`
Expected: FAIL, cannot find module `../src/reviews.mjs`

- [ ] **Step 3: Implement review writing and validation**

Write `docs/agile/reviews/<gate>-<role>.yaml` with `gate`, `role`, `verdict`, `evidence`, `open_risks`, `at` (ISO). Evidence paths resolve relative to root and must exist. `validateReviews` fails on: missing role record, `verdict: fail`, `pass-with-risk` without an active waiver, and any role listed in `artifactAuthors` for a required artifact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/reviews.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: add sign-off records with self-approval rejection"
```

---

### Task 5: Boundary enforcement

**Files:**
- Create: `src/boundary.mjs`
- Modify: `src/cli.mjs` (set `stageBase` and `writeScope` on `next`, verify on `check`)
- Test: `test/boundary.test.mjs`

**Interfaces:**
- Consumes: `loadState`.
- Produces: `changedPaths(root: string, stageBase: string): Promise<string[]>`, `matchesScope(path: string, globs: string[]): boolean`, `checkBoundary(root: string, writeScope: string[], stageBase: string): Promise<{ok: boolean, violations: string[]}>`.

- [ ] **Step 1: Write the failing test**

```js
test('flags an untracked file outside scope', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, 'src/ok.mjs'), '');
  await writeFile(join(repo, 'docs/agile/vision.md'), '# vision');
  const out = await checkBoundary(repo, ['src/**'], 'HEAD');
  assert.equal(out.ok, false);
  assert.deepEqual(out.violations, ['docs/agile/vision.md']);
});

test('ignores changes committed before stageBase', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, 'docs/agile/vision.md'), '# vision');
  const base = await commitAll(repo, 'pre-stage');
  await writeFile(join(repo, 'src/ok.mjs'), '');
  const out = await checkBoundary(repo, ['src/**'], base);
  assert.equal(out.ok, true);
});

test('flags an ignored file outside scope', async () => {
  const repo = await gitRepo();
  await writeFile(join(repo, '.gitignore'), 'secret.txt\n');
  await writeFile(join(repo, 'secret.txt'), 'x');
  const out = await checkBoundary(repo, ['src/**'], 'HEAD');
  assert.deepEqual(out.violations, ['secret.txt']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/boundary.test.mjs`
Expected: FAIL, cannot find module `../src/boundary.mjs`

- [ ] **Step 3: Implement path collection and scope matching**

Collect `git diff --name-only <stageBase>`, `git ls-files --others --exclude-standard`, and `git ls-files --others --ignored --exclude-standard`, so tracked, untracked, and gitignored files are all caught. Convert scope globs (`**`, `*`) to RegExp. `check` fails with the sorted violation list. When `stageBase` is null, refuse the check rather than comparing against `HEAD`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/boundary.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: enforce role write scope against stage base"
```

---

### Task 6: Gate check — artifacts, checks, reviews, boundary

**Files:**
- Create: `src/gates.mjs`
- Modify: `src/cli.mjs` (`check` command), `src/state.mjs` (gate flip)
- Test: `test/gates.test.mjs`

**Interfaces:**
- Consumes: `validateReviews`, `checkBoundary`, `parseProfile`.
- Produces: `GATE_DEFS: Record<string, GateDef>`, `checkGate(root: string, gate: string): Promise<{ok: boolean, failures: string[]}>`, `runChecks(root: string, profile: StackProfile): Promise<{ok: boolean, results: {name: string, ok: boolean, detail: string}[]}>`.
- `GateDef` = `{phases: string[], artifacts: {path: string, headings: string[]}[], roles: string[]}`.

- [ ] **Step 1: Write the failing test**

```js
test('G0 fails on a missing artifact and passes when complete', async () => {
  const repo = await flowRepo({ gate: 'G0' });
  const bad = await checkGate(repo, 'G0');
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.some(f => f.includes('vision.md')));

  await completeG0Artifacts(repo);
  const good = await checkGate(repo, 'G0');
  assert.equal(good.ok, true);
});

test('a missing stack command fails the gate instead of skipping', async () => {
  const repo = await flowRepo({ gate: 'G3', profileCommand: 'definitely-not-a-command' });
  const out = await checkGate(repo, 'G3');
  assert.equal(out.ok, false);
  assert.ok(out.failures.some(f => f.includes('definitely-not-a-command')));
});

test('second failure writes an escalation', async () => {
  const repo = await flowRepo({ gate: 'G0' });
  await run(['check', 'G0'], repo);
  await run(['check', 'G0'], repo);
  assert.equal(loadState(repo).escalation.reason, 'gate-failed-twice');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gates.test.mjs`
Expected: FAIL, cannot find module `../src/gates.mjs`

- [ ] **Step 3: Implement `GATE_DEFS` and `checkGate`**

Required artifacts and headings per spec section 5 and 7: G0 needs `vision.md` (`## Vision`, `## Success metrics`), `personas.md` (`## Personas`), `success-metrics.md`, `backlog.md` (`## Backlog`); G1 adds architecture files, at least one ADR, `ux/flows.md`, `ux/tokens.json`, one wireframe; G2 adds `plan/sprint-NN.md`; G3 adds `quality/test-strategy.md`, `release/readiness.md`, `release-notes.md`, one `build/*/review.md`; G4 adds `operations/slos.md`, one runbook, `operations/load-test.md`. Gate flip writes `{status:'pass', at: ISO}` and only when all four validators pass. Every executable check runs through a shell with a 10-minute timeout; a command that exits non-zero, is not found, or times out adds a failure with its name and output tail. Failures increment `state.gateRetries[gate]`; at 2 the gate stays locked and `state.escalation` is written with `reason: 'gate-failed-twice'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gates.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: add gate checks for artifacts, checks, reviews, boundaries"
```

---

### Task 7: Waivers with expiry

**Files:**
- Create: `src/waivers.mjs`
- Modify: `src/cli.mjs` (`waive`), `src/gates.mjs` (honor active waivers)
- Test: `test/waivers.test.mjs`

**Interfaces:**
- Consumes: `loadState`.
- Produces: `addWaiver(root: string, w: WaiverInput): void`, `activeWaivers(state: State, now: Date): Waiver[]`, `WaiverInput` = `{gate, requirement, reason, expires, approver}`.

- [ ] **Step 1: Write the failing test**

```js
test('expired waiver no longer opens the gate', async () => {
  const repo = await seededRepo();
  addWaiver(repo, { gate: 'G3', requirement: 'load-test', reason: 'r', expires: '2020-01-01', approver: 'human' });
  assert.equal(activeWaivers(loadState(repo), new Date('2026-10-27')).length, 0);
  addWaiver(repo, { gate: 'G3', requirement: 'load-test', reason: 'r', expires: '2027-01-01', approver: 'human' });
  assert.equal(activeWaivers(loadState(repo), new Date('2026-10-27')).length, 1);
});

test('rejects a non-human approver', async () => {
  const repo = await seededRepo();
  assert.equal(await run(['waive', 'G3', '--reason', 'r', '--expires', '2027-01-01', '--approver', 'agent'], repo), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/waivers.test.mjs`
Expected: FAIL, cannot find module `../src/waivers.mjs`

- [ ] **Step 3: Implement waiver storage**

Waivers live in `state.waivers` and `docs/agile/waivers/<gate>.md`. Only `approver === 'human'` is accepted. `activeWaivers` filters on `expires >= today`; `status` lists active waivers and hides expired ones.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/waivers.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat: add human-signed expiring waivers"
```

---

### Task 8: Templates

**Files:**
- Create: `templates/story.md`, `templates/adr.md`, `templates/review.yaml`, `templates/state.json`, `templates/waiver.md`, `templates/retro.md`, `templates/postmortem.md`, `templates/checklists.md`
- Test: `test/templates.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: template files only; `templates/story.md` headings are the contract used by `agile-ba` and by gate structural checks.

- [ ] **Step 1: Write the failing test**

```js
test('story template carries every required section', async () => {
  const md = await readFile('templates/story.md', 'utf8');
  for (const h of ['## Story', '## Acceptance criteria', '## Non-goals', '## Test plan', '## Wireframe', '## NFRs', '## Open questions', '## Slice']) {
    assert.ok(md.includes(h), h);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/templates.test.mjs`
Expected: FAIL, ENOENT `templates/story.md`

- [ ] **Step 3: Write the templates**

`story.md` follows spec 7.1 exactly. `adr.md` uses Status/Context/Decision/Consequences/Alternatives. `review.yaml` matches spec 7.2. `retro.md` requires what worked, what did not, actions with owners. `postmortem.md` requires timeline, contributing causes, actions, and forbids individual blame. `checklists.md` holds DoR and DoD items from spec section 11.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/templates.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add templates test
git commit -m "feat: add artifact templates for stories, adrs, reviews, retros"
```

---

### Task 9: Skill validator and the `agile-flow` orchestrator skill

**Files:**
- Create: `src/skills.mjs`, `skills/agile-flow/SKILL.md`
- Modify: `src/cli.mjs` (`skills` command)
- Test: `test/skills.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateSkill(path: string): {ok: boolean, failures: string[]}`, `validateSkillTree(dir: string): {ok: boolean, failures: string[]}`. Required sections: `## Inputs`, `## Outputs`, `## Boundaries`, `## Method`, `## Refuse`; frontmatter must carry `name` and `description`.

- [ ] **Step 1: Write the failing test**

```js
test('rejects a skill without a Boundaries block', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sk-'));
  await writeFile(join(dir, 'SKILL.md'), '---\nname: x\ndescription: y\n---\n## Inputs\n## Outputs\n## Method\n## Refuse\n');
  const out = validateSkill(join(dir, 'SKILL.md'));
  assert.equal(out.ok, false);
  assert.match(out.failures.join('\n'), /Boundaries/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skills.test.mjs`
Expected: FAIL, cannot find module `../src/skills.mjs`

- [ ] **Step 3: Write `skills/agile-flow/SKILL.md`**

Content: the phase and gate table from the spec; the spawn envelope (role, gate or story id, phase, input paths, output paths, state snapshot, end with summary and artifact paths); the rule that only this skill spawns; flat topology; retry-once-then-escalate; the three human checkpoints plus escalation triggers; gate checks are performed only by `node bin/agile-flow.mjs check <gate>`; boundary violations stop the stage. `## Boundaries` declares `owned_paths: docs/agile/state.json, docs/agile/reviews/, docs/agile/retro/` and `must_not` for product artifacts, gate signing, and code edits.

- [ ] **Step 4: Run test to verify it passes**

Run: `node bin/agile-flow.mjs skills`
Expected: exit 0, one line per validated skill; test file passes with `node --test test/skills.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src skills test
git commit -m "feat: add skill validator and agile-flow orchestrator skill"
```

---

### Task 10: PO, BA, UX skills

**Files:**
- Create: `skills/agile-po/SKILL.md`, `skills/agile-ba/SKILL.md`, `skills/agile-ux/SKILL.md`
- Test: `test/skills.test.mjs` (extend to assert all nine exist and validate)

**Interfaces:**
- Consumes: `templates/story.md`, `validateSkillTree`.
- Produces: skill files whose `## Outputs` paths match the artifact contract exactly.

- [ ] **Step 1: Write the failing test**

```js
test('po, ba, ux skills validate', async () => {
  for (const s of ['agile-po', 'agile-ba', 'agile-ux']) {
    const out = validateSkill(`skills/${s}/SKILL.md`);
    assert.equal(out.ok, true, `${s}: ${out.failures.join('; ')}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skills.test.mjs`
Expected: FAIL, ENOENT `skills/agile-po/SKILL.md`

- [ ] **Step 3: Write the three skills**

PO: vision, personas, success metrics, priority order, release scope, demo script, G3 functionality sign-off with evidence requirements. BA: story shaping using the template, GWT completeness, non-goals, NFR elicitation, open-question register, turning each open question into either a resolved answer or a blocked DoR. UX: research, flows covering empty/loading/error/success, tokens JSON, static HTML wireframes referenced by story id, usability check before G1. Each `## Boundaries` names owned paths and the handoffs to the roles that own what it must not do.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skills.test.mjs`
Expected: PASS for the three-skill test; `node bin/agile-flow.mjs skills` prints three PASS lines.

- [ ] **Step 5: Commit**

```bash
git add skills test
git commit -m "feat: add product owner, business analyst, and ux skills"
```

---

### Task 11: Architect and tech lead skills

**Files:**
- Create: `skills/agile-architect/SKILL.md`, `skills/agile-tech-lead/SKILL.md`
- Test: `test/skills.test.mjs`

**Interfaces:**
- Consumes: `templates/adr.md`.
- Produces: `architecture/{system.md,nfrs.md,fitness-functions.md,c4/,adrs/,debt.md}` contract used by G1 and G3.

- [ ] **Step 1: Extend the failing test**

```js
test('architect and tech lead declare distinct ownership', async () => {
  const a = await readFile('skills/agile-architect/SKILL.md', 'utf8');
  const t = await readFile('skills/agile-tech-lead/SKILL.md', 'utf8');
  assert.ok(a.includes('docs/agile/architecture/'));
  assert.ok(!a.includes('debt.md'));
  assert.ok(t.includes('debt.md'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skills.test.mjs`
Expected: FAIL, ENOENT

- [ ] **Step 3: Write the two skills**

Architect: C4 context and container, NFR targets as measurable values, ADR per structural decision, fitness functions as executable checks wired into the stack profile, brownfield legacy assessment, G1 and G3 conformance sign-off. Tech lead: per-story solution plan, seam and file list, debt register in `architecture/debt.md` with owner and trigger, feasibility and slice-size check at DoR, review of test quality, G1 and G3 debt sign-off. Both state the handoff: architect does not write product code; tech lead does not define system structure.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skills.test.mjs`
Expected: PASS for the two-file test; `node bin/agile-flow.mjs skills` shows five PASS lines

- [ ] **Step 5: Commit**

```bash
git add skills test
git commit -m "feat: add architect and tech lead skills"
```

---

### Task 12: Dev, QA, SRE skills

**Files:**
- Create: `skills/agile-dev/SKILL.md`, `skills/agile-qa/SKILL.md`, `skills/agile-sre/SKILL.md`
- Test: `test/skills.test.mjs` (all nine)

**Interfaces:**
- Consumes: `templates/checklists.md`, `templates/postmortem.md`.
- Produces: `build/<story-id>/{plan.md,red.log,green.log,review.md}`, `quality/*`, `operations/*` contracts used by DoD, G3, and G4.

- [ ] **Step 1: Write the failing test**

```js
test('all nine skills validate and are present', async () => {
  const names = (await readdir('skills')).sort();
  assert.deepEqual(names, ['agile-architect','agile-ba','agile-dev','agile-flow','agile-po','agile-qa','agile-sre','agile-tech-lead','agile-ux']);
  const out = validateSkillTree('skills');
  assert.equal(out.ok, true, out.failures.join('\n'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skills.test.mjs`
Expected: FAIL, three skill directories missing

- [ ] **Step 3: Write the three skills**

Dev: the six-step inner loop from spec section 6, RED evidence rules (zero failures is a failure), trunk commits, CI config, IaC, observability hooks, and the delivery mode. QA: test strategy with pyramid ratios, automation at story level, exploratory charters, a11y and perf checks, defect format with severity and reproduction, evidence for G3. SRE: SLOs with error budgets, runbooks per alert, dashboards and alerts as code, load test with recorded result, incident process, blameless postmortem, G3 supportability and G4 readiness sign-off.

- [ ] **Step 4: Run the validator and the full suite**

Run: `node bin/agile-flow.mjs skills && node --test`
Expected: nine PASS lines, exit 0, all tests pass

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat: add dev, qa, and sre skills"
```

---

### Task 13: Greenfield fixture, full flow validation

**Files:**
- Create: `fixtures/sample-app/` (source, tests, `package.json`, `README.md`)
- Create: `fixtures/run-flow.sh`
- Test: `test/fixture-flow.test.mjs`

**Interfaces:**
- Consumes: the CLI, all nine skills.
- Produces: executable validation that every gate refuses when an input is missing and opens when complete.

- [ ] **Step 1: Write the failing test**

```js
test('G0 refuses without artifacts and opens when complete', async () => {
  const repo = await copyFixture();
  await run(['init', '--mode', 'greenfield', '--repo', repo], repo);
  assert.equal(await run(['check', 'G0'], repo), 1);
  await writeMinimalG0(repo);
  assert.equal(await run(['sign', 'G0', '--role', 'po', '--verdict', 'pass', '--evidence', 'docs/agile/vision.md'], repo), 0);
  assert.equal(await run(['check', 'G0'], repo), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/fixture-flow.test.mjs`
Expected: FAIL, fixture missing

- [ ] **Step 3: Build the fixture and the script**

Sample app is a small HTTP service with one endpoint and a passing test suite. `run-flow.sh` drives intake to retro by calling CLI commands and writing the artifacts each phase requires. The script must fail loudly on the first non-zero exit.

- [ ] **Step 4: Run the validation**

Run: `bash fixtures/run-flow.sh fixtures/sample-app`
Expected: every gate reported `pass`, final phase `retro`, app test suite green

- [ ] **Step 5: Commit**

```bash
git add fixtures test
git commit -m "test: validate full flow on greenfield fixture"
```

---

### Task 14: Brownfield fixture, README, install

**Files:**
- Create: `fixtures/legacy-app/` (copy of sample app plus an injected legacy defect)
- Create: `install.sh`, `README.md`
- Test: `test/flow-negative.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `install.sh` symlinking each `skills/<name>` into `~/.config/opencode/skills/<name>`; README documenting the nine skills, the phases, the gate rules, and the escalation contract.

- [ ] **Step 1: Write the failing negative tests**

```js
test('boundary violation blocks the stage', async () => {
  const repo = await runningFlowRepo();
  await writeFile(join(repo, 'docs/agile/vision.md'), '# hijacked');
  const out = await run(['check', 'G0'], repo);
  assert.equal(out, 1);
});

test('expired waiver closes the gate again', async () => {
  const repo = await waivedRepo('2020-01-01');
  assert.equal(await run(['check', 'G3'], repo), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/flow-negative.test.mjs`
Expected: FAIL, fixtures missing

- [ ] **Step 3: Build the brownfield fixture, README, and install script**

Legacy defect: duplicated business rule in two modules with no test. The brownfield run must produce `architecture/legacy-assessment.md`, a debt entry, and a story that removes the duplication. `install.sh` refuses to overwrite an existing directory that is not a symlink.

- [ ] **Step 4: Run everything**

Run: `node --test && bash fixtures/run-flow.sh fixtures/legacy-app`
Expected: all tests pass; brownfield run reaches retro and the legacy assessment exists

- [ ] **Step 5: Commit**

```bash
git add fixtures test README.md install.sh
git commit -m "test: validate brownfield flow, add readme and install script"
```
