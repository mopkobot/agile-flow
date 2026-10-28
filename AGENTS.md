# Agent instructions

This repository is a policy engine, not an app. Two things must stay true after every change: the skills describe a workflow a competent team could actually follow, and the CLI enforces the parts of that workflow that can be checked mechanically.

Read `README.md` for the product, `CONTRIBUTING.md` for the change rules, and `SECURITY.md` before touching identity, gates, or the tracker.

## Non-negotiables

- Write the failing test first. `node --test` must be green at every commit.
- Never weaken a gate, a `must_not`, a boundary, or a check to make a scenario pass. Fix the scenario.
- No runtime dependencies. Node 20+ standard library only.
- Files are authoritative. If behavior and documentation disagree, that is a bug.
- Never commit secrets, tokens, passphrases, or a populated `docs/agile/` state.
- Never edit through `~/.config/opencode/skills/`; edit `skills/` in this repo. The symlinks pick it up.
- Do not add estimation, a daily standup, or a tracker other than GitHub. Those exclusions are deliberate.

## Commands

```bash
node --test                          # full suite, includes two end-to-end flows
node --test test/<file>.test.mjs     # one file
node bin/agile-flow.mjs skills       # structural validation of all ten skills
node bin/agile-flow.mjs harness      # what a target repo is missing
npm pack --dry-run                   # what publishing would ship
```

The suite takes about 30 seconds. If it fails without a code change, suspect the spawn-heavy fixture tests first.

## Repository map

```
skills/<name>/SKILL.md   policy: inputs, outputs, owned paths, method, refusals
bin/agile-flow.mjs       entry point, exits with run()'s code
src/cli.mjs              command dispatch, locking, human/role auth wiring
src/state.mjs            state schema, lock, optimistic revision, init
src/phases.mjs           phase order, role per phase, gate placement
src/gates.mjs            gate definitions and validators
src/boundary.mjs         owned paths, stage diff, glob matching
src/reviews.mjs          sign-off records and validation
src/identity.mjs         expiring role tokens
src/auth.mjs             scrypt passphrase hashing and prompts
src/waivers.mjs          human waivers with expiry
src/stories.mjs          card claims and transitions
src/debt.mjs             allocation, plan resolution, completion
src/retro.mjs            typed retro actions and approvals
src/audit.mjs            claim sampling, records
src/tracker.mjs          GitHub labels and issue bodies
templates/               artifact shapes the skills write
fixtures/                end-to-end targets; never edit to make a test pass
test/                    behavior, refusals, concurrency, flows
docs/specs, docs/plans   design history
```

## Recipes

### Change a skill

1. Edit `skills/<name>/SKILL.md`.
2. Keep the five required sections and a `Boundaries` block with `owned_paths` and `must_not`.
3. Keep owned paths disjoint from the other roles.
4. Add or update an assertion in `test/curriculum.test.mjs` or `test/skills-*.test.mjs`.
5. Run `node --test` and `node bin/agile-flow.mjs skills`.

A skill without `Boundaries` is rejected at load. A skill whose rule cannot be checked should say so plainly rather than implying enforcement.

### Add or change a CLI command

1. Write the failing test in `test/`.
2. Add the case to the dispatch switch in `src/cli.mjs`.
3. If it mutates state, add it to `MUTATING` so it runs under `withStateLock`.
4. Read through `loadState`, never from memory.
5. Test the refusal path, not only the happy path.

### Add a gate or artifact requirement

1. Extend `GATE_DEFS` in `src/gates.mjs`.
2. Validate structure, executable checks, sign-offs, and boundaries.
3. Add a test that the gate refuses when the requirement is absent.
4. Update the README gate table and the spec.

### Change a template

Templates are contracts. If you add a heading, add the validator that requires it, or the heading is decoration.

## Conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- One coherent change per commit. Tests and docs travel with the behavior.
- Errors go to stderr and produce a non-zero exit; never exit 0 after a refusal.
- Prefer explicit refusal messages that say what to do next.
- Keep files focused. `src/cli.mjs` is the largest module; split it by concern before it grows further.

## Review checklist

- Does a gate still refuse when its evidence is missing?
- Is a role still unable to write outside its scope?
- Can two agents still conflict without one being told?
- Is every claim the new code trusts backed by a citation or a re-run?
- Does the README still describe reality?

## Escalate instead of guessing

Ask before: changing the state schema incompatibly, altering how identity or human auth works, adding a dependency, changing a gate's signers, or deleting a test. Record the decision in the commit message.
