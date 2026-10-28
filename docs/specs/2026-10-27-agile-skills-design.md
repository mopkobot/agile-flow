# Agile Flow Skills — Design Spec

Date: 2026-10-27
Status: awaiting review
Owner: solo operator, agents in every role

## 1. Purpose

Build a set of self-contained OpenCode skills that run a real agile software delivery lifecycle on a target repository. The flow produces working code, tests, architecture records, quality evidence, release artifacts, and operational artifacts. It imitates a delivery team in which every role is played by an agent, coordinated by one orchestrator, with hard gates that cannot be talked past.

The flow is not a teaching simulation and not a ceremony generator. Its output is a working increment plus the evidence that the increment is safe to release.

## 2. Scope

In scope:

- Nine skills: one orchestrator and eight roles.
- A phase state machine with hard gates and human escalation.
- A zero-dependency Node CLI that owns state and gate enforcement.
- Artifact templates and a machine-readable state file.
- A throwaway fixture used to validate the flow end to end.

Out of scope:

- Tracker integrations. Markdown only.
- Estimation. Priority order and slice size only.
- A daily standup ceremony.
- Nested subagents.
- Multi-user operation. One operator, many agents.

## 3. Decisions

| # | Decision | Value |
|---|---|---|
| A1 | Output | Real delivery into a repo named by the operator |
| A2 | Operators | Solo operator; agents play all roles |
| A3 | Codebase | Greenfield and brownfield; brownfield starts with legacy assessment |
| B1 | Skill shape | Orchestrator `agile-flow` plus eight role skills |
| B2 | Isolation | One subagent per role; artifacts on disk are the only handoff |
| B3 | Content | Fresh, self-contained skills. No delegation to existing skills |
| B4 | Naming | `agile-flow`, `agile-po`, `agile-ba`, `agile-ux`, `agile-architect`, `agile-tech-lead`, `agile-dev`, `agile-qa`, `agile-sre` |
| B5 | Boundaries | Hard. A role may not act, write, or sign outside its declared scope |
| C1 | Rhythm | Linear first increment, then a repeating sprint loop |
| C2 | Order | intake → discovery → shaping → ux → architecture → planning → build → quality → release → operations → retro |
| C3 | Gates | Hard. Advance only on satisfied gate |
| C4 | Human checkpoints | Three: G0 scope, G2 plan, G3 release, plus any escalation |
| D1 | Tech lead | Distinct role: in-codebase solutioning, technical debt, feasibility |
| D2 | Architect | System structure, NFRs, architecture conformance |
| D3 | Dev and DevOps | One skill, `agile-dev`, with a delivery mode |
| D4 | Release sign-off | Four-way: PO functionality, tech lead debt, architect conformance, SRE supportability |
| E1 | Artifacts | `docs/agile/` with one folder per concern |
| E2 | State | `state.json` inside `docs/agile/` |
| E3 | Tracker | Markdown only |
| E4 | Authority | Files are authoritative; chat is disposable |
| E5 | Story format | Tracer bullet, persona story, Given/When/Then, non-goals, test plan, wireframes, open questions, NFRs |
| F1 | Stack | Stack-agnostic with detection; opinionated defaults only when greenfield and undetectable |
| F2 | Practices | Mandatory: TDD, trunk-based, CI on push, ADRs, fitness functions, testing pyramid, IaC, observability by default, blameless postmortem |
| F3 | Advisory practices | Tech radar, DDD tactical patterns |
| F4 | Enforcement | Executable checks where possible; signed review records otherwise |
| F5 | TDD split | Separate test-author and implementer subagents |
| F6 | UX depth | Research, flows, tokens, static HTML wireframes attached to stories |
| F7 | SRE depth | Artifacts plus load testing |
| G1 | Location | Versioned repo at the project root, symlinked into the OpenCode global skills directory |
| G2 | Ceremonies | Sprint planning, demo, retro. No daily standup |
| G3 | Estimation | None. Priority order and slice size |
| G4 | Done | Definition of Done as section 11 |
| G5 | Validation | One throwaway sample project, run end to end, greenfield and brownfield |
| G6 | Language | English |

## 4. Role model

Each role is a skill loaded by a subagent spawned by the orchestrator. A role reads its inputs from disk, writes its outputs to disk, records a sign-off when it owns one, and returns a short summary with artifact paths. A role never advances the phase.

| Skill | Responsibility | Sign-off owned |
|---|---|---|
| `agile-flow` | State machine, spawn sequencing, gate checks, resume, retrospectives | None. It enforces only |
| `agile-po` | Vision, personas, success metrics, priority order, release scope, demo | Functionality at G3 |
| `agile-ba` | Story shaping, acceptance criteria, edge cases, NFRs, open questions | Story readiness (DoR) |
| `agile-ux` | Research, flows, design tokens, HTML wireframes, usability evidence | Interaction quality at G1 |
| `agile-architect` | System structure, C4, ADRs, NFR targets, fitness functions, legacy assessment | Architecture conformance at G1 and G3 |
| `agile-tech-lead` | In-codebase solutioning, feasibility, debt register, code standards, review | Technical debt at G1 and G3 |
| `agile-dev` | TDD inner loop, trunk commits, CI pipeline, IaC, observability hooks | Build complete per story |
| `agile-qa` | Test strategy, pyramid coverage, exploratory testing, a11y, perf, security evidence, defects | None at G3; supplies the evidence the PO signs against |
| `agile-sre` | SLOs, error budgets, runbooks, dashboards and alerts as code, load tests, incident process | Supportability at G3 and G4 |

### 4.1 Story shaping

Story writing happens in the shaping phase and again in each refinement. The PO facilitates and owns priority. Four roles contribute before a story can be marked ready:

- BA: acceptance criteria completeness, edge cases, NFRs, open questions.
- UX: interaction states including empty, loading, error, and success; copy; wireframe reference.
- SRE: operability, SLO impact, failure modes, on-call cost.
- Tech lead: feasibility, slice size, technical debt introduced or repaid.

DoR requires all four sign-offs plus a PO priority value. A story without a wireframe reference is not ready.

### 4.2 Role boundaries

Roles do not cross their defined boundary. A role that finds work outside its scope does not do it. It records the need and returns a handoff request to the orchestrator, which spawns the owning role.

Rules:

1. **Write scope.** Each role writes only to its owned paths. Any write outside that set is a boundary violation and fails the stage.
2. **No self-approval of another role's work.** A role signs its own domain artifacts as an attestation, but may not review and sign off work authored by a different role, and never its own implementation. Reviewer independence is enforced inside the build loop: the reviewer spawn must differ from the implementer spawn.
3. **No silent substitution.** A role may not perform another role's activity even when it believes it can do it better or the owning role is unavailable.
4. **No scope expansion.** A role may not add requirements, change priorities, or widen the increment.
5. **Handoff, not takeover.** Missing input from another role is escalated or requested, never invented.
6. **Explicit non-applicability.** A role may declare a requirement not applicable, with a reason. It may not silently skip it.

Owned paths and forbidden actions:

| Skill | Owned paths | Must not |
|---|---|---|
| `agile-flow` | `state.json`, `reviews/` index, `retro/` | Write product artifacts, sign a gate, edit code |
| `agile-po` | `vision.md`, `personas.md`, `success-metrics.md`, `backlog.md` | Write stories, design UX, choose architecture, write code, sign quality evidence |
| `agile-ba` | `stories/`, `refinements/` | Set priority, draw wireframes, decide architecture, write production code |
| `agile-ux` | `ux/` | Choose technology, write production code, define acceptance scope, approve architecture |
| `agile-architect` | `architecture/` | Write product code, write stories, set business priority, sign technical debt |
| `agile-tech-lead` | `build/*/plan.md`, `build/*/review.md`, debt register in `architecture/debt.md` | Define system architecture, write stories, set priority, sign architecture conformance |
| `agile-dev` | product code, `build/*/{red.log,green.log}`, CI config, IaC | Edit acceptance criteria, reorder backlog, approve its own review, sign release |
| `agile-qa` | `quality/` | Fix product code, change AC, waive a defect, sign release |
| `agile-sre` | `operations/` | Change product behavior, redefine architecture, alter acceptance criteria |

A violation is detected, not negotiated. `check` compares the paths changed during a stage against the active role's write scope, and rejects a sign-off whose role authored the artifact. On violation the stage fails, the change is not committed, and the orchestrator escalates with the offending paths.

## 5. Phase and gate model

```
intake → discovery → shaping → ux → architecture → planning
      → build(story loop) → quality → release → operations → retro
                                                  ↑             │
                                                  └── next sprint ┘
```

| Phase | Entry | Exit artifact | Gate | Signers |
|---|---|---|---|---|
| intake | Repo named by operator | `stack-profile.md` | none | orchestrator |
| discovery | Stack profile | `vision.md`, `personas.md`, `success-metrics.md`, `backlog.md` | G0 | PO + human |
| shaping | Backlog outline | `stories/<id>.md` with DoR | DoR per story | BA, UX, SRE, tech lead, PO |
| ux | Ready stories | `ux/flows.md`, `ux/tokens.json`, `ux/wireframes/<id>.html` | folded into G1 | UX |
| architecture | Ready stories, UX flows | `architecture/system.md`, `nfrs.md`, `fitness-functions.md`, `c4/`, `adrs/` | G1 | architect, tech lead, UX + human |
| planning | G1 green | `plan/sprint-NN.md` | G2 | human |
| build | G2 green | `build/<story-id>/` plus commits | DoD per story | dev, reviewer, QA |
| quality | Stories at DoD | `quality/test-strategy.md`, `defects.md`, `evidence/` | folded into G3 | QA |
| release | Quality green | `release/readiness.md`, `release-notes.md` | G3 | PO, tech lead, architect, SRE + human |
| operations | G3 green | `operations/` complete, load test recorded | G4 | SRE |
| retro | Operations green | `retro/retro-NN.md` with actions | none | orchestrator + all roles |

Brownfield adds a legacy assessment to discovery: inventory of existing modules, test coverage baseline, debt register seed, and risks. The assessment feeds architecture and shaping.

After retro, the loop re-enters shaping with retro actions and remaining backlog items. The sprint number increments.

### 5.1 Gate semantics

A gate is satisfied only when all three hold:

1. Every required artifact exists and passes structural validation: required headings present, no empty required section, and every path referenced by the artifact exists.
2. Every executable check defined by the stack profile passes.
3. Every required sign-off record exists with `verdict: pass` and evidence paths that exist.

The orchestrator cannot satisfy a gate by assertion. Only `bin/agile-flow.mjs check <gate>` can flip a gate, and only on exit code 0.

Gate failure path: retry once with corrective instructions supplied by the failing role, then escalate to the human. Retry counts live in `state.json`; a gate never opens because retries were exhausted.

## 6. Build inner loop

Per story, flat sibling spawns. No nesting.

1. `agile-dev` plans the slice; writes `build/<story-id>/plan.md` with files touched, seams, and test list.
2. Test-author spawn writes failing unit tests. `red.log` captures command, output, and failing count.
3. Implementer spawn writes the minimum code to green. `green.log` captures command, output, and passing count.
4. Reviewer spawn checks AC coverage, standards, debt, and test quality. Writes `review.md` with verdict.
5. Commit on trunk in small slices. CI runs the full check set.
6. QA attaches story evidence, then DoD is evaluated.

The gate refuses, and escalates, when:

- `red.log` shows zero failures or does not exist.
- `green.log` shows a suite that did not run.
- Changed-code coverage is below threshold.
- A reviewer verdict is not `pass`.

## 7. Artifact contract

```
docs/agile/
  vision.md  personas.md  success-metrics.md  stack-profile.md
  backlog.md  stories/<id>.md  refinements/
  ux/flows.md  ux/tokens.json  ux/usability-notes.md  ux/wireframes/<id>.html
  architecture/system.md  architecture/nfrs.md  architecture/fitness-functions.md
  architecture/c4/  architecture/adrs/NNNN-<slug>.md
  plan/sprint-NN.md
  build/<story-id>/{plan.md,red.log,green.log,review.md}
  quality/{test-strategy.md,defects.md,evidence/}
  release/{readiness.md,release-notes.md}
  operations/{slos.md,runbooks/,alerts/,load-test.md,postmortems/}
  retro/retro-NN.md
  reviews/<gate>-<role>.yaml
  waivers/<gate>.md
  state.json
```

### 7.1 Story template

```markdown
# <id> <title>

## Story
As a <persona>, I want <capability>, so that <outcome>.

## Acceptance criteria
- Given <context>
  When <action>
  Then <observable result>

## Non-goals
- <explicitly out of scope>

## Test plan
- Unit: <cases>
- Integration: <cases>
- E2E: <cases or none with reason>

## Wireframe
- <path to ux/wireframes/<id>.html>

## NFRs
- <latency, availability, accessibility, security, operability>

## Open questions
- <question> — owner: <role>, status: open|resolved

## Slice
size: small|medium|large
priority: <rank>
dependencies: <ids or none>
```

### 7.2 Sign-off record

```yaml
gate: G3
role: sre
verdict: pass
evidence:
  - docs/agile/operations/slos.md
  - docs/agile/operations/load-test.md
open_risks: []
note: <required for human sign-offs: the decision the human supplied>
at: 2026-10-27T10:00:00Z
```

`verdict: fail` blocks the gate. `verdict: pass-with-risk` blocks the gate unless a waiver exists.

### 7.3 State file

```json
{
  "version": 1,
  "targetRepo": "/abs/path",
  "mode": "greenfield",
  "sprint": 1,
  "phase": "build",
  "activeRole": "agile-dev",
  "writeScope": ["src/**", "test/**", "docs/agile/build/**"],
  "stageBase": "<git sha at stage start>",
  "gates": {
    "G0": { "status": "pass", "at": "..." },
    "G1": { "status": "pass", "at": "..." },
    "G2": { "status": "pass", "at": "..." },
    "G3": { "status": "locked", "at": null },
    "G4": { "status": "locked", "at": null }
  },
  "stories": {
    "S-001": { "dor": "pass", "dod": "in-progress", "retries": 0 }
  },
  "gateRetries": { "G3": 1 },
  "waivers": [],
  "escalation": null
}
```

`escalation` is either `null` or an object with `reason`, `question`, `blockedPhase`, and `at`. When set, `next` refuses to advance.

### 7.4 Waivers

Human-signed only. A waiver names the gate, the requirement waived, the reason, the approver, and an expiry date. Active waivers are listed by `status` so the flow is visibly running degraded. Expired waivers are ignored and the gate closes again.

## 8. CLI contract

`bin/agile-flow.mjs`, Node 20+, zero dependencies.

| Command | Behavior | Exit |
|---|---|---|
| `init --repo <path> --mode greenfield\|brownfield` | Creates `docs/agile/`, state file, stack profile | 0, 2 if already initialized |
| `status` | Prints phase, gate states, blocked reasons, open waivers, escalation | 0 |
| `next` | Prints the next action, the skill to spawn, and required inputs | 0, 3 if blocked |
| `check <gate>` | Runs structural, executable, sign-off, and boundary validation: no write outside `writeScope`, no self-approval, gate reachable from the current phase | 0 pass, 1 fail with reasons |
| `advance [--phase <phase>]` | Revalidates the current gate, then moves to the next phase; at retro it increments the sprint and returns to shaping | 0, 1 if the gate no longer verifies or a phase boundary was violated |
| `sign <gate> --role <role> --verdict <v> --evidence <paths>` | Writes a review record after validating role and evidence | 0, 1 invalid |
| `waive <gate> --reason <text> --expires <date> --approver human` | Records a human waiver | 0, 1 if approver is not human |
| `resume` | Clears an escalation only when the human supplies a resolution note | 0, 1 |

The CLI never edits product code and never commits.

Executable checks come from `stack-profile.md`, which declares commands for test, changed-code coverage, lint, build, secret scan, a11y, and load. Detection reads `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, and `Dockerfile`. When nothing is detected, the orchestrator asks the operator; it does not invent a stack.

## 9. Skill contract

Every role skill follows one shape, so the orchestrator can spawn any of them uniformly:

```markdown
---
name: agile-<role>
description: <when to use, one sentence>
---
# <Role>

## Inputs
<artifact paths this role must read, and what to do when missing>

## Outputs
<artifact paths this role must write>

## Boundaries
owned_paths: <glob list>
must_not: <forbidden actions, one per line>
handoff: <which role owns each thing this role does not>

## Method
<role-specific method, checklists, and quality bar>

## Refuse
<conditions where the role must stop and escalate instead of producing output>
```

The `Boundaries` block is mandatory and is copied into `state.json.writeScope` when the role is active, so the CLI can validate writes against it. A role skill without a `Boundaries` block is rejected at load time.

Frontmatter carries `name` and `description` only. Role skills do not spawn subagents; only `agile-flow` spawns. Role skills state their inputs and outputs by path, and they must not write outside their owned paths.

The orchestrator spawns with a fixed prompt envelope: role name, story or gate id, phase, input paths, output paths, current `state.json` snapshot, and the instruction to end with a summary and artifact paths.

## 10. Escalation policy

Escalate to the human, write `state.json.escalation`, and stop when:

- The same gate fails twice.
- Required input is missing: repo name, credentials, product decision, legal or licensing question.
- An irreversible or destructive action is required: force-push, data migration, production deploy, secret rotation, dependency replacement.
- An executable check cannot run because the toolchain is absent and no waiver exists.
- A security-relevant finding appears.
- An artifact would have to be fabricated to satisfy a gate.

Escalation is a stop, not a question answered by guessing. `resume` requires a human resolution note.

## 11. Definition of Ready and Done

Ready: story template complete, four shaping sign-offs, wireframe attached, no blocking open question, slice size small or medium.

Done: AC verified by test, changed-code coverage ≥ 80%, lint clean, no new vulnerabilities, docs updated, observability hooks present, mockups honored, no unowned technical debt added, CI green on trunk.

## 12. Practice enforcement map

| Practice | Enforced at | Mechanism |
|---|---|---|
| TDD | build | RED and GREEN evidence files, separate authors |
| Trunk-based | build | One branch, small commits, no long-lived branches |
| CI on push | build, release | Stack profile CI command |
| ADRs | architecture, G1 | ADR required for each structural decision |
| Fitness functions | G1, G3 | `fitness-functions.md` plus executed checks |
| Testing pyramid | quality, G3 | Test strategy declares layers; coverage and counts checked |
| IaC | release, G4 | Infrastructure declared as code or explicitly not applicable with reason |
| Observability by default | DoD, G4 | Hooks present per story; dashboards and alerts as code |
| Blameless postmortem | operations, retro | Template requires timeline, causes, actions, no names |
| Tech radar | advisory | Mentioned in architecture notes only |
| DDD tactical patterns | advisory | Mentioned in architecture notes only |

## 13. Validation plan

1. Create `fixtures/sample-app` as a minimal greenfield service.
2. Run the flow from intake to retro. Assert every gate refuses while a required artifact, check, or sign-off is missing.
3. Run again on a brownfield copy with an injected legacy problem. Assert the legacy assessment appears and feeds the debt register.
4. Assert escalation fires on: second gate failure, missing toolchain, and a request to force-push.
5. Assert a boundary violation is refused: a role writing outside its `writeScope`, and a role signing off on an artifact it authored.
5. Assert `state.json` alone is sufficient to resume after a session restart.

Validation passes only if the fixture reaches retro with a working increment and all gate evidence present.

## 14. Repository layout

```
agile-flow/
  skills/agile-flow/SKILL.md
  skills/agile-po/SKILL.md
  skills/agile-ba/SKILL.md
  skills/agile-ux/SKILL.md
  skills/agile-architect/SKILL.md
  skills/agile-tech-lead/SKILL.md
  skills/agile-dev/SKILL.md
  skills/agile-qa/SKILL.md
  skills/agile-sre/SKILL.md
  bin/agile-flow.mjs
  templates/{story.md,adr.md,review.yaml,state.json,waiver.md,retro.md,postmortem.md}
  fixtures/sample-app/
  docs/specs/2026-10-27-agile-skills-design.md
  README.md
```

Installation: symlink each `skills/<name>` directory into `~/.config/opencode/skills/<name>`.

## 15. Open questions

None blocking. Deferred by decision: tracker adapters, estimation, multi-user operation, nested subagents.
