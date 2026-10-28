# Claude Code instructions

Read `AGENTS.md` first. It is the single source of agent policy for this repository.

Quick reference:

```bash
node --test                        # full suite
node bin/agile-flow.mjs skills     # validate all skills
node bin/agile-flow.mjs harness    # repo harness gaps
```

Hard rules: failing test first, no new runtime dependencies, never weaken a gate or a `must_not` to make a test pass, never commit secrets or `docs/agile/` state.
