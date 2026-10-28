# AI development harness

Written once per brownfield repository, then maintained. Its purpose is to make agent work efficient and checkable.

## Product context

- What the product does, for whom, and the three outcomes that matter now.
- Domain terms that must be used consistently.
- What is explicitly out of scope.

## Architecture context

- Deployable units, their responsibilities, and their data stores.
- The boundaries an agent must not cross.
- Decisions that are expensive to reverse, with ADR links.

## Reliability

- The signals that say the system is healthy, and where they are emitted.
- The first three checks when an alert fires.
- Who is on call, and the escalation path.

## Agent rules

- Commands: install, test, lint, build, run.
- Files an agent must not touch.
- How to ask a question: what counts as ambiguous, and who owns the answer.
- Definition of done, and where evidence is written.

## Verification

- The single command that proves a change is safe.
- What it does not cover, and the manual check that fills the gap.

## Current gaps

| Gap | Owner role | Planned fix |
|---|---|---|
| <missing harness element> | <role> | <artifact or issue> |
