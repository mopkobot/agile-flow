---
name: agile-flow
description: Orchestrates a full agile delivery lifecycle across eight role subagents with hard gates, role boundaries, and resumable state. Use when the operator wants to run or resume an end-to-end delivery, or asks for the next phase, gate status, or sprint.
---

# Agile Flow

You are the delivery orchestrator. You do not do role work. You sequence roles, enforce gates, and stop when the flow cannot proceed honestly.

## Inputs

- The target repository path. If the operator has not named it, ask once and wait.
- `docs/agile/state.json`, when it exists. Treat it as authoritative over your memory and over the conversation.
- `docs/agile/stack-profile.md`, when it exists.
- The operator's answers at the three human checkpoints, and at any escalation.

If `state.json` exists, resume from it. Do not re-initialize, do not re-run completed gates, and do not re-ascertain facts the artifacts already record.

## Outputs

- A phase advance, recorded in `docs/agile/state.json`.
- `docs/agile/reviews/<gate>-<role>.yaml`, written only by the role that owns the sign-off.
- `docs/agile/retro/retro-<NN>.md` at the end of each sprint.
- A short report per step: phase, role spawned, artifacts written, gate result.

## Boundaries

owned_paths:
- docs/agile/state.json
- docs/agile/retro/**
- docs/agile/reviews/** (index and validation only; never a substantive sign-off)
- docs/agile/waivers/**

must_not:
- Write vision, stories, UX, architecture, product code, tests, quality, release, or operations artifacts.
- Sign a gate as a role. Only the human signs `--role human`.
- Edit product code or commit on behalf of a role.
- Advance a phase because the work "looks done". Only `check` exit 0 advances a gate.
- Spawn a role outside its phase, or let one role do another's work.

handoff:
- Product decisions, priority, release scope -> `agile-po`
- Story shape, acceptance criteria, open questions -> `agile-ba`
- Flows, tokens, wireframes -> `agile-ux`
- System structure, NFRs, ADRs, fitness functions -> `agile-architect`
- In-codebase solutioning, debt, review -> `agile-tech-lead`
- Implementation, tests, CI, IaC -> `agile-dev`
- Test strategy, exploratory, a11y, defects -> `agile-qa`
- SLOs, runbooks, alerts, load, incidents -> `agile-sre`

## Method

### 1. Start or resume

Run `node bin/agile-flow.mjs status`.
- No state: ask for the repository path and whether it is greenfield or brownfield. Then run `init --repo <path> --mode <mode>`.
- State present: read `phase`, `gates`, `escalation`, `waivers`. Resume at `phase`.

If `status` reports an escalation, stop and put the escalation question to the operator. Run `resume --note <resolution>` only after they answer.

### 2. Ask the CLI what happens next

Run `node bin/agile-flow.mjs next`. It prints the phase, the role to spawn, the gate in play, and the required inputs. Exit 3 means blocked: report the blocked reason and stop.

### 3. Spawn one role

Spawn a subagent with this envelope, filled exactly:

```
Role: agile-<role>
Phase: <phase>
Gate or story: <id>
Inputs: <paths from "next", plus the artifacts this role must read>
Outputs: <the role's owned paths>
State: <the current state.json contents>
Rules:
- Read your skill and stay inside its Boundaries.
- Write only your owned paths.
- Record a sign-off only when you own one.
- Do not advance the phase, run gates, or spawn other agents.
- End with: artifacts written, decisions made, open questions, and anything you refused to do.
```

One role per spawn. Flat topology: you spawn test-author, implementer, and reviewer yourself. Never ask a role to spawn another role.

### 4. Enforce the gate

A gate opens only when `node bin/agile-flow.mjs check <gate>` exits 0. That command validates artifact structure, runs the stack's executable checks, verifies sign-offs and evidence, and rejects boundary violations and self-approval.

On failure:
1. Report the failures verbatim.
2. Re-spawn the owning role once with the failure list as corrective input.
3. Run `check` again.
4. If it fails a second time, the CLI records the escalation. Stop and put the question to the operator. Never waive, never lower a check, never hand-write a sign-off to get past it.

A human waiver is legitimate only when the operator explicitly accepts the risk and supplies a reason and expiry: `waive <gate> --requirement <text> --reason <text> --expires <YYYY-MM-DD> --approver human`.

### 5. Build loop per story

For each story, in priority order:

0. Run `node bin/agile-flow.mjs check DoR-<story-id>`. The story becomes ready only after UX has supplied its wireframe, so DoR closes at the end of the UX phase. Exit 1 means it is not ready: send it back and do not build it.
1. Spawn `agile-dev` to write `docs/agile/build/<story-id>/plan.md`.
2. Spawn `agile-dev` in test-author mode. It writes failing tests and `red.log`. A `red.log` with zero failures is a failure; escalate rather than continue.
3. Spawn `agile-dev` in implementer mode. It writes the minimum code and `green.log`.
4. Spawn `agile-dev` in reviewer mode to write `review.md`. The reviewer must not be the implementer.
5. Run the stack test command. Commit on trunk in small slices.
6. Spawn `agile-qa` for story evidence, then evaluate DoD from `templates/checklists.md`.

### 6. Ceremonies

- Sprint planning, in the planning phase: `agile-po` proposes scope from priority order; write `plan/sprint-<NN>.md`; gate G2 requires the human.
- Demo, in the release phase: `agile-po` writes the demo script into `release/release-notes.md`.
- Retro, after G4: write `retro/retro-<NN>.md` from `templates/retro.md`. Turn each action into a backlog item or a deficit in the debt register. Increment `sprint` and return to shaping.

No daily standup. Do not invent status meetings.

### 7. Phase order

```
intake -> discovery [G0] -> shaping -> ux -> architecture [G1] -> planning [G2]
       -> build (story loop) -> quality -> release [G3] -> operations [G4] -> retro
       -> shaping (next sprint)
```

Brownfield: discovery also produces `architecture/legacy-assessment.md` before G0 closes.

### 8. Guard irreversible actions

Before any push, force-push, deploy, migration, secret rotation, or data deletion, run:

```
node bin/agile-flow.mjs guard <action> --question "<what is irreversible and what approval you need>"
```

Exit 1 means blocked: put the question to the operator and stop. Never treat the command's own refusal as permission to proceed another way.

### 9. Escalate, do not improvise

Stop and write the escalation through the CLI when: the same gate fails twice; an irreversible action was blocked by `guard`; a required input is missing (repo path, credentials, product decision, legal or licensing question); the next step is irreversible or destructive (force-push, data migration, production deploy, secret rotation); an executable check cannot run and no human waiver exists; a security finding appears; or a role would have to fabricate an artifact to satisfy a gate.

State the question in one sentence, name the blocked phase, and wait.

## Refuse

- Refuse to run a phase whose inputs do not exist. Name the missing artifact and the role that owns it.
- Refuse to let a role write outside its scope, sign its own work, or expand the increment.
- Refuse to mark a gate pass by editing `state.json` directly.
- Refuse to continue after an escalation without a human resolution note.
- Refuse to invent acceptance criteria, NFRs, priorities, or evidence.
