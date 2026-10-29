# Contributing

## Before you change anything

```bash
node --test
node bin/agile-flow.mjs skills
```

Both must pass. The suite includes two end-to-end flows and takes roughly 30 seconds.

## Changing a skill

A skill is policy. Edit `skills/<name>/SKILL.md`, keep the required sections (`Inputs`, `Outputs`, `Boundaries`, `Method`, `Refuse`), and keep `owned_paths` disjoint from other roles. Add or adjust a test in `test/curriculum.test.mjs` when you change a rule that matters.

Skills declare what they must not do. Do not weaken a `must_not` to make a scenario pass; fix the scenario instead.

## Changing the CLI

- Write the failing test first, in `test/`, then the implementation.
- Keep zero runtime dependencies.
- Mutating commands run under `withStateLock`.
- Any new gate must be refused when its artifacts, checks, or sign-offs are missing. Test the refusal, not only the pass.
- Coverage for new code: changed-code rows when available.

## Test rules

Every test must prove it is worth keeping. A test enters the suite only when all four hold:

- It has at least one assertion.
- Its name reads as the behavior and condition, so a reader understands it without opening the body.
- It fails for the reason the change could break.
- It survives the kill matrix with mutation testing: it catches something no other test catches. A test that kills no unique mutant is deleted or merged.

Run the mutation tool the stack provides. When there is none, mutate the covered branch by hand and record the result. Never keep a test for the coverage number alone.

## Commit style

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. One coherent change per commit. Tests and docs in the same commit as the behavior they describe.

The subject states why the change was made; the body explains the reason and the behavior it enables. The diff shows what changed. A message that only restates the diff is not a commit message.

## Reporting a security issue

Do not open a public issue for a bypass of gates, boundaries, identity, or the tracker. See `SECURITY.md`.
