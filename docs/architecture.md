# Architecture

## Shape

One Node process, no runtime dependencies. `bin/agile-flow.mjs` calls `run()` in `src/cli.mjs`, which dispatches a command, wraps mutating commands in a state lock, and prints a result. Exit codes are the interface.

## Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `cli.mjs` | Dispatch, flags, human/role auth wiring, exit codes | all of `src/` |
| `state.mjs` | State schema, init, lock, revision check | `auth.mjs` |
| `phases.mjs` | Phase order, role per phase, gate placement | none |
| `gates.mjs` | Gate definitions, artifact/evidence checks | boundary, reviews, debt, audit, stack |
| `boundary.mjs` | Owned path globs, stage diff, ignored-file baseline | git |
| `reviews.mjs` | Sign-off records, self-approval rules | state |
| `identity.mjs` | Expiring role tokens | auth, state |
| `auth.mjs` | scrypt hashing, passphrase prompts | none |
| `waivers.mjs` | Human waivers with expiry | state |
| `stories.mjs` | Card claims and transitions | state |
| `debt.mjs` | Allocation, plan resolution, completion | state |
| `retro.mjs` | Typed actions, approvals | state, reviews |
| `audit.mjs` | Claim sampling and audit records | state |
| `tracker.mjs` | GitHub issue sync | state, gh |
| `stack.mjs` | Stack detection and command profiles | filesystem |

## Invariants

1. A gate opens only through `checkGate` returning ok and writing the state.
2. State writes are serialized by a lock file and guarded by a revision check.
3. A role's writes are compared against a diff cut from `stageBase`; the flow, reviews, and current signers are the only additions to a role's scope.
4. Sign-offs are validated for presence, verdict, evidence existence, and evidence location.
5. Release requires citations, executed QA commands, an audit for the current sprint, and debt completion.
6. The CLI never edits product code and never commits.

## Data

All artifacts live under `docs/agile/` in the target repository. State is `docs/agile/state.json`. Skills read and write paths, never a database.

## Failure model

Refusals are normal. Every validator returns failures rather than throwing, the CLI prints them, and the exit code is non-zero. Only programming errors throw.
