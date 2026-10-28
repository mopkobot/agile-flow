# Reliability signals

This project ships a CLI and a skill set, not a service. The signals that matter are about trust in the tool.

## Signals

| Signal | Where | Healthy | What it means when unhealthy |
|---|---|---|---|
| CI result on `main` | GitHub Actions `ci` | green on Node 20 and 22 | The published behavior is unverified; do not release. |
| Suite duration | CI log | under ~60s | Spawn-heavy fixture tests are slowing or hanging. |
| Flake watch | repeated CI runs | no test fails without a code change | An absolute threshold or spawn assumption has returned; treat as a bug. |
| Skill validation | `agile-flow skills` | ten PASS lines, exit 0 | A skill lost a required section or a boundary block. |
| Gate refusal rate | operator observation | gates refuse when evidence is missing | A validator regressed and is trusting instead of checking. |
| Audit outcomes | `audit record` history | occasional failure, then fix | Always-pass audits suggest rubber-stamping. |
| Tracker sync | `tracker sync` exit | 0, issues match stories | Divergence between cards and labels. |
| Lock contention | stderr | rare stale-revision errors | Two agents are writing the same phase; serialise the work. |

## Thresholds

- Coverage on changed code: 80%, enforced at G3.
- Suite: zero failures, no skips except Maven when `mvn` is absent.
- CI: no red on `main` for more than one commit.
- Token lifetime: 14 days by default; rotate on suspicion.

## Escalation

1. CI red on `main`: revert or fix before any feature work.
2. Skill validation failing: fix the skill, never the validator.
3. Repeated audit failures: stop release and review the role that produced the claim.
4. Lock contention or stale revisions: serialise agents, do not disable the revision check.

There is no on-call rotation. The operator is the escalation path.
