# Product

## What this is

Agile Flow is a policy engine for AI-assisted delivery. Ten OpenCode skills play the roles of a small product team, and a zero-dependency CLI enforces the parts of the process that a model cannot be trusted to enforce on itself: gates, role boundaries, sign-offs, claims, and evidence.

It is not a project tracker, not an estimation tool, and not a replacement for a human decision-maker.

## Who it is for

| Persona | Situation | What they get |
|---|---|---|
| Solo builder | Runs agents on a real repository and wants working software, not a plausible transcript | A delivery loop that refuses to advance on missing tests, evidence, or sign-offs |
| Tech lead on an agent-assisted team | Several agents work in parallel on one codebase | Card claims, a lock-protected state file, and role-scoped writes |
| Consultant or reviewer | Needs to audit how an increment was produced | Citable reviews, executed QA evidence, and an independent audit record |
| Learner | Wants to see an agile lifecycle end to end | Complete artifacts from vision to postmortem, with the rules attached |

## The problem

Agent teams fail in ways that look like success:

- Tests are written after the code, or not at all, and the suite is green because it asserts nothing.
- Review is a restatement of the diff, with no location and no cost.
- A release sign-off reflects optimism rather than measurement.
- One role quietly does another's job, so the independent check disappears.
- Documents accumulate; nobody can tell which claims were verified.

Each failure is cheap to produce and expensive to detect later. The product exists to make each one expensive to produce.

## Outcomes

1. A working increment with tests that fail without the change.
2. Evidence at every gate, located and reproducible.
3. A role boundary that is enforced by the tool, not by good intentions.
4. A release decision backed by citations, executed commands, and a fresh audit.
5. A retro that changes the skills, the backlog, or the debt register rather than filing a summary.

## Non-goals

- Estimation, story points, velocity.
- A daily standup or any meeting simulator.
- Trackers other than GitHub.
- Multi-tenant hosting or a hosted service.
- Replacing human judgment on scope, risk, or release.

## Success signals

| Signal | Target | How it is observed |
|---|---|---|
| Gates refuse when evidence is missing | Every gate has a refusal test | Test suite |
| Boundary escapes | Zero undetected in tests | Boundary and concurrency tests |
| Time to first green increment | One session on a small repository | Operator experience |
| Audit catches a false claim | Occasional, then fixed | `audit record` history |
| Skill drift | Caught by policy tests | `test/curriculum.test.mjs` |
| Rework after release | Defects found by audit rather than users | Defect records |

These are signals, not a dashboard. Nothing here is telemetry.

## Principles

- **Enforce what can be checked, and say what cannot.** A rule that only exists in prose is labelled as such.
- **Evidence over assertion.** A claim without a location, command, or measurement is not evidence.
- **Independent check at the point of no return.** The auditor has no authorship stake.
- **Small surfaces.** Ten skills, one CLI, no dependencies, files as the interface.
- **Refusal is a feature.** A blocked gate is the product working.

## Scope of the first release

Version 1.0 covers a greenfield or brownfield repository, one operator with many agents, a single sprint loop with a second-sprint path, GitHub as the only tracker, and Apache 2.0 licensing.

Deferred: additional trackers, portfolio or multi-team coordination, hosted dashboards, estimation, and cryptographic agent identity beyond same-user isolation.
