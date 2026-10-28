# Agile Flow Skills

Ten OpenCode skills that run a real agile delivery lifecycle: one orchestrator, eight delivery roles, one independent auditor, hard gates, and enforced role boundaries.

The flow produces a working increment, not a ceremony transcript. Every phase leaves artifacts on disk, every gate is machine-checked, and every role is forbidden from doing another role's job.

## Skills

| Skill | Role | Owns |
|---|---|---|
| `agile-flow` | Orchestrator | Phase sequencing, gate checks, escalation, retrospectives |
| `agile-po` | Product owner | Vision, personas, metrics, priority, release scope |
| `agile-ba` | Business analyst | Stories, acceptance criteria, NFRs, open questions |
| `agile-ux` | UX designer | Flows, tokens, HTML wireframes, usability notes |
| `agile-architect` | Architect | System structure, NFR targets, ADRs, fitness functions |
| `agile-tech-lead` | Technical lead | Story solutioning, debt register, code review |
| `agile-dev` | Developer and DevOps | TDD loop, trunk commits, CI, IaC, observability |
| `agile-qa` | Quality analyst | Test strategy, exploratory, a11y, defects |
| `agile-sre` | SRE | SLOs, runbooks, alerts, load tests, postmortems |
| `agile-auditor` | Auditor | Independent claim sampling at G3 and G4 |

## Install

```bash
./install.sh
```

Links each `skills/<name>` into `~/.config/opencode/skills/<name>`. Override the destination with `AGILE_SKILLS_TARGET`. The installer refuses to replace a real directory.

## Use

In a target repository:

```bash
node /path/to/agile-flow/bin/agile-flow.mjs init --mode greenfield --repo .
```

Then ask the agent to run `agile-flow`. It reads `docs/agile/state.json`, spawns the role for the current phase, and advances only after `check <gate>` exits 0.

## Phases and gates

```
intake -> discovery [G0] -> shaping -> ux -> architecture [G1] -> planning [G2]
       -> build (story loop) -> quality -> release [G3] -> operations [G4] -> retro
       -> shaping (next sprint)
```

- **DoR story**: story template, four shaping sign-offs (BA, UX, SRE, tech lead), wireframe present, no blocking open question. Checked with `agile-flow check DoR-<id>` after UX.
- **Harness (brownfield first)**: product, architecture, reliability, agent rules, commands. `agile-flow harness
agile-flow identity issue --role <role>` lists gaps. The orchestrator asks whether to define one before discovery.
- **G0 scope**: vision, personas, metrics, backlog. PO and human.
- **G1 design**: architecture, ADRs, NFRs, fitness functions, threat model, glossary, UX, tech-lead review. Architect, tech lead, UX, human.
- **G2 plan**: sprint scope. Human.
- **G3 release**: tests, coverage, lint, build, secret scan, load evidence. PO functionality, tech lead debt, architect conformance, SRE supportability, human.
- **G4 operations**: SLOs live, runbooks, alerts as code, load test recorded. SRE.

## CLI

```bash
agile-flow init --mode greenfield|brownfield --repo <path>
agile-flow status
agile-flow next
agile-flow advance [--phase <phase>]
agile-flow guard <push|force-push|deploy|migrate|rotate-secret|delete-data> --question <text>
agile-flow story <id> <in-dev|in-qa|done> --role <role> [--agent <name>]
agile-flow tracker sync [--dry-run]
agile-flow setup-human
agile-flow audit sample [--count <n>]
agile-flow audit record --gate <G3|G4> --verdict pass|fail --checked <n> --note <text>
agile-flow harness
agile-flow identity issue --role <role>
agile-flow check <gate|DoR-<story-id>>
agile-flow sign <gate> --role <role> --verdict pass|fail|pass-with-risk --evidence <paths>
agile-flow waive <gate> [--requirement <text>] --reason <text> --expires YYYY-MM-DD --approver human
agile-flow resume --note <resolution>
agile-flow skills
```

Exit codes: `0` ok, `1` failure, `2` already initialized, `3` blocked.

Story status is the claim mechanism for parallel agents. `in-dev` belongs to the dev role, `in-qa` to QA, `done` to the flow. A rejected transition means another agent owns the card. `tracker sync` mirrors status to GitHub issue labels (`status:ready`, `status:in-dev`, `status:in-qa`, `status:done`).

Role sign-offs are authenticated with per-role tokens: the human runs `identity issue --role <role>` and passes the token to that role as `AGILE_ROLE_TOKEN`. Tokens are stored only as hashes and can be rotated.

Human sign-offs are authenticated with a passphrase hashed at `init` or `setup-human`. Set `AGILE_HUMAN_PASSPHRASE` for that command, or run it in an interactive terminal. An agent shell without the passphrase cannot sign as the human.

Coverage: a command that enforces its own threshold (`--check-coverage`, `--cov-fail-under`, `--fail-under`) is trusted on exit code; otherwise the line coverage it reports must reach 80%. Point the command at changed-code coverage when the tool supports it.

## Rules the flow enforces

- **Hard gates.** A gate opens only on exit 0 from `check`. Nothing else advances a phase.
- **Executable checks.** Stack commands run for real. A missing command fails the gate; it is never skipped.
- **Boundaries.** Every role has an owned path set. A write outside it fails the stage.
- **No self-approval.** A signer may not have authored the artifact it signs.
- **Human-only waivers.** Waivers carry a reason and an expiry, and expire the gate back to closed.
- **No fabricated evidence.** RED and GREEN logs must show real runs; missing evidence is a refusal.
- **Escalation.** Two failed attempts, a missing decision, an irreversible action, or an unrunnable check stops the flow and asks the operator.

## Definition of Done

Acceptance criteria verified by test, changed-code coverage at least 80%, lint clean, no new vulnerabilities, docs updated, observability hooks present, mockups honored, no unowned debt, CI green on trunk, RED and GREEN evidence recorded, reviewer verdict `pass`.

## Repository layout

```
skills/<name>/SKILL.md   ten skills
bin/agile-flow.mjs       CLI entry
src/                     state machine, gates, boundaries, reviews, waivers
templates/               story, ADR, review, state, waiver, retro, postmortem, checklists
fixtures/sample-app/     greenfield validation target
fixtures/legacy-app/     brownfield validation target with duplicated rule
fixtures/run-flow.sh     drives intake to retro
test/                    CLI and flow tests
docs/specs/              design spec
docs/plans/              implementation plan
.github/workflows/ci.yml runs tests and skill validation on push and PR
```

## Design constraints

- Files are authoritative. Chat is disposable; a phase advances only when artifacts on disk and `check` agree.
- Gates are hard. The orchestrator cannot open one by assertion, and waivers are human-signed with an expiry.
- Roles are bounded. Each skill declares owned paths and forbidden actions; the CLI rejects writes outside them.
- Claims are cited. Review findings need `path:line`; QA evidence needs a real command; NFRs need a measurement.
- Judgment is sampled. An independent auditor at G3 and G4 tries to falsify the record rather than trust it.
- Parallel work is coordinated. Story status claims a card for one agent; state writes take a lock and reject stale revisions.
- No estimation, no daily standup, no tracker other than GitHub. Those were deliberate exclusions.

## Known limits

- Role tokens make casual impersonation fail, but an agent holding the human passphrase can still mint tokens. Same-user isolation is not a security boundary.
- The auditor is a separate spawn by instruction; the CLI records the agent but cannot prove which process ran it.
- Stack detection covers Node, Python, Go, Rust, Java, and Ruby. Only Node and Ruby are exercised by running tests here; the Maven path is tested when `mvn` is installed.
- Harness assessment on brownfield is advisory by decision; missing tests or CI are recorded, not blocked.

## Validate

```bash
node --test

# greenfield
cp -R fixtures/sample-app /tmp/af-green && cd /tmp/af-green
git init -q && git add -A && git commit -qm init
bash /path/to/agile-flow/fixtures/run-flow.sh /tmp/af-green

# brownfield
cp -R fixtures/legacy-app /tmp/af-brown && cd /tmp/af-brown
git init -q && git add -A && git commit -qm init
bash /path/to/agile-flow/fixtures/run-flow.sh /tmp/af-brown brownfield
```

The brownfield run must surface the duplicated name-length rule in `docs/agile/architecture/legacy-assessment.md` before any story is built.

## License

MIT. See `LICENSE`.
