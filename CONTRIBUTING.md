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

## Commit style

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. One coherent change per commit. Tests and docs in the same commit as the behavior they describe.

## Reporting a security issue

Do not open a public issue for a bypass of gates, boundaries, identity, or the tracker. See `SECURITY.md`.
