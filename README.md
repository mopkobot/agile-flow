# Agile Flow

[![ci](https://github.com/mopkobot/agile-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/mopkobot/agile-flow/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Ten OpenCode skills that run a real agile delivery lifecycle: one orchestrator, eight delivery roles, one independent auditor, hard gates, and machine-enforced role boundaries.

The output is a working increment plus the evidence that it is safe to release. Not a ceremony transcript, not a planning simulator.

```
intake → discovery → shaping → ux → architecture → planning
      → build → quality → release → operations → retro → next sprint
```

## Why this exists

Agent teams fail in predictable ways: they skip tests, agree with themselves, write plausible-looking documents nobody checks, and quietly do each other's jobs. This harness makes those failures expensive:

- A gate opens only when `check` exits 0. No assertion, no prose, no "looks done".
- Every role has owned paths. Writing outside them fails the phase.
- Sign-offs require a token the orchestrator cannot mint.
- Review findings need `path:line`. QA evidence needs a real command. NFRs need a measurement.
- An auditor tries to falsify the record before release.
- The operator sets a standing tech-debt allocation that G2 enforces and G3 verifies.

## Install

```bash
git clone https://github.com/mopkobot/agile-flow.git
cd agile-flow
./install.sh
```

Symlinks each `skills/<name>` into `~/.config/opencode/skills/`. Override the target with `AGILE_SKILLS_TARGET`. The installer refuses to replace a real directory. Edits to `skills/` are live immediately through the symlinks.

Requires Node 20 or newer. Zero runtime dependencies.

## Use

In the repository you want to deliver:

```bash
node /path/to/agile-flow/bin/agile-flow.mjs init --mode greenfield --repo . --debt-percent 20
```

Then ask the agent to run `agile-flow`. It reads `docs/agile/state.json`, spawns the role for the current phase, and advances only after the gate passes.

Brownfield repositories are asked one question first: do you want an AI development harness (product context, architecture boundaries, reliability signals, agent rules) before discovery starts?

## What each skill actually does

| Skill | Phase | What happens | Sign-off |
|---|---|---|---|
| `agile-flow` | all | Reads state, spawns one role at a time, runs gate checks, records escalations, closes retros | None; enforces only |
| `agile-po` | discovery, planning, release | Writes vision, personas, success metrics, ranked backlog, sprint scope proposal, release notes; runs the demo | G3 functionality |
| `agile-ba` | shaping, refinement | Turns backlog items into tracer-bullet stories: Given/When/Then, non-goals, test plan, wireframe link, NFRs, open questions | DoR readiness |
| `agile-ux` | shaping, ux | Writes flows with empty/loading/error/success states, design tokens, static HTML wireframes, usability notes with contrast checks | G1 interaction quality |
| `agile-architect` | discovery, architecture | Writes system view, C4 diagrams, measurable NFRs, ADRs, fitness functions, threat model, glossary, legacy assessment; selects patterns from problem and NFRs | G1 structure, G3 conformance |
| `agile-tech-lead` | shaping, build, release | Writes the per-story solution plan, reviews every change for correctness, code smells and clean code with cited findings, owns the debt register, allocates debt at planning | G1 and G3 technical debt |
| `agile-dev` | build | Claims a card, writes failing tests, then the minimum code, records RED and GREEN evidence, keeps trunk green, owns CI, IaC and observability hooks | Build complete per story |
| `agile-qa` | quality | Writes test strategy, criterion-by-criterion evidence with executed commands, exploratory charters, a11y/perf/security checks, defect records with severities | Supplies evidence; does not sign release |
| `agile-sre` | architecture, operations | Writes SLOs and error budgets, runbooks per alert, alerts and dashboards as code, load-test results, incident process, blameless postmortems | G3 supportability, G4 readiness |
| `agile-auditor` | release, operations | Samples the riskiest claims, reproduces or falsifies each against code and commands, records the audit | Records audits; never signs gates |

Every role declares owned paths, forbidden actions, and explicit refusal conditions. A role that meets work outside its scope hands off instead of doing it.

## Gates

| Gate | Requires | Signers |
|---|---|---|
| DoR | Story template, four shaping sign-offs (BA, UX, SRE, tech lead), wireframe, priority, no blocking question | Those four plus PO priority |
| G0 scope | Vision, personas, success metrics, backlog | PO + human |
| G1 design | Architecture, NFRs with measurements, ADRs, fitness functions, threat model, glossary, UX flows, tokens, wireframes | Architect, tech lead, UX + human |
| G2 plan | Sprint plan with debt allocation matching the configured percentage; rows resolve to real cards | Human |
| G3 release | Tests, changed-code coverage, lint, build, secret scan, TDD evidence, cited reviews, QA evidence, audit | PO, tech lead, architect, SRE, human |
| G4 operations | SLOs, runbooks, alerts as code, load-test result, audit | SRE |

Failure path: retry once with corrective input, then escalate and stop. A gate never opens because retries ran out.

## Commands

```bash
agile-flow init --mode greenfield|brownfield --repo <path> [--debt-percent N]
agile-flow status
agile-flow next
agile-flow advance [--phase <phase>]
agile-flow check <gate|DoR-<story-id>>
agile-flow sign <gate> --role <role> --verdict pass|fail|pass-with-risk --evidence <paths> [--note <text>] [--agent <name>]
agile-flow waive <gate> --requirement <text> --reason <text> --expires YYYY-MM-DD --approver human
agile-flow guard <push|force-push|deploy|migrate|rotate-secret|delete-data> --question <text>
agile-flow resume --note <resolution>
agile-flow story <id> <in-dev|in-qa|done> --role <role> [--agent <name>]
agile-flow tracker sync [--dry-run]
agile-flow audit sample [--count N]
agile-flow audit record --gate <G3|G4> --verdict pass|fail --checked N --note <text>
agile-flow retro list | check | approve --target <skill> --note <text>
agile-flow debt set <percent>
agile-flow harness
agile-flow identity issue --role <role> [--ttl-days N]
agile-flow setup-human
agile-flow skills
```

Exit codes: `0` ok, `1` failure, `2` already initialized, `3` blocked.

## Parallel agents

Story status is the claim. `in-dev` requires `--agent`; a card held by another agent is refused. `in-qa` belongs to QA, `done` to the flow. State writes take a lock and reject stale revisions, so two agents cannot silently clobber each other. `tracker sync` mirrors status to GitHub labels and refreshes the issue body.

## Retro loop

Every retro action is typed and targeted. `advance` refuses to leave retro until each one is real:

- `process` targets a skill. The diff is shown, applied, tested, and approved by the human with `retro approve`. Changes are live immediately through the symlinks.
- `product` targets a backlog card. PO adds it, BA shapes it, `tracker sync` opens the issue.
- `debt` targets a debt-register row.
- `dropped` keeps a written reason.

## Configuration

- **Debt allocation.** Set once, enforced every sprint at G2 and verified at G3.
- **Harness.** Brownfield repos are offered a harness before discovery; `harness` lists gaps with fixes.
- **Identity.** Role tokens are issued under human authentication and expire; only hashes are stored.
- **Human authentication.** Passphrase hashed at init or `setup-human`. Human sign-offs and token issuance require it.
- **Tracker.** GitHub via `gh`, status labels and issue bodies.

## Repository layout

```
skills/<name>/SKILL.md     ten skills
bin/agile-flow.mjs         CLI entry
src/                       state machine, gates, boundaries, identity, tracker, audit
templates/                 story, ADR, review, state, waiver, retro, postmortem, harness, checklists
fixtures/sample-app/       greenfield validation target
fixtures/legacy-app/       brownfield target with a duplicated rule
fixtures/run-flow.sh       drives intake to retro
test/                      CLI, gate, concurrency, and end-to-end tests
docs/specs/                design spec
docs/plans/                implementation plan
```

## Validate

```bash
node --test
node bin/agile-flow.mjs skills
```

The suite includes two end-to-end flows: a greenfield app and a brownfield app whose duplicated business rule must be surfaced before build. It also covers gate refusals, boundary violations, stale writes, token expiry, and a real second sprint with TDD evidence.

## Design constraints

- Files are authoritative. Chat is disposable.
- Gates are hard. Only `check` opens them.
- Roles are bounded. Owned paths are enforced, not advisory.
- Claims are cited. Structure is checked; honesty is sampled.
- Judgment is independent at release. The auditor has no authorship stake.
- No estimation, no daily standup, no tracker other than GitHub. Deliberate exclusions.

## Known limits

- Role tokens stop casual impersonation; an agent holding the human passphrase can still mint them. Same-user isolation is not a security boundary.
- The auditor is a separate spawn by instruction. The CLI records which agent ran it but cannot prove it.
- Stack detection covers Node, Python, Go, Rust, Java, and Ruby. Node and Ruby are exercised end to end here; Maven runs when `mvn` is installed.
- Harness assessment is advisory by operator decision.
- Coverage uses changed-code rows when the tool reports them, otherwise whole-project line coverage.

## License

Copyright 2026 mopkobot. Apache License 2.0. See `LICENSE` and `NOTICE`.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
