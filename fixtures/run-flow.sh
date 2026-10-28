#!/usr/bin/env bash
# Drive the agile flow from intake to retro against a target repository.
# Usage: run-flow.sh <repo-path> [greenfield|brownfield]
set -euo pipefail

REPO="${1:?usage: run-flow.sh <repo-path> [greenfield|brownfield]}"
MODE="${2:-greenfield}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$HERE/../bin/agile-flow.mjs"
A="$REPO/docs/agile"

cd "$REPO"

say() { printf '\n== %s ==\n' "$1"; }
flow() { node "$CLI" "$@"; }
commit() { git add -A && git commit -qm "$1" >/dev/null; }
put() { mkdir -p "$(dirname "$1")"; cat > "$1"; }
sign() { gate="$1"; role="$2"; ev="$3"; shift 3; flow sign "$gate" --role "$role" --verdict pass --evidence "$ev" "$@" >/dev/null; }

say "init"
flow init --mode "$MODE" --repo . >/dev/null
commit "chore: initialize agile flow"

if [ "$MODE" = "brownfield" ]; then
  mkdir -p "$A/architecture"
  put "$A/architecture/legacy-assessment.md" <<'EOF'
# Legacy assessment

## Inventory
- `src/app.mjs`: request handling and greeting rule.
- `src/server.mjs`: process entry.

## Test baseline
- 2 tests, happy path only.
- Empty-name and length-limit paths untested.

## Duplicated rules
- Name length enforced in `greet()` at 40 characters and in `handler()` at 50.
- Divergence is invisible to the suite.

## Risks
- Silent behavior change if either limit moves.
EOF
  commit "docs: legacy assessment"
fi

say "discovery"
flow next >/dev/null
flow advance >/dev/null
flow next >/dev/null
put "$A/vision.md" <<'EOF'
# Vision

## Vision
Greet a visitor by name through one HTTP endpoint.

## Success metrics
- p95 response under 100 ms in the load test.
- Zero unhandled errors for valid input.
EOF
put "$A/personas.md" <<'EOF'
# Personas

## Personas
- Visitor: wants a greeting; current workaround is reading source.
EOF
put "$A/success-metrics.md" <<'EOF'
# Metrics

## Metrics
| metric | target | measurement |
|---|---|---|
| latency p95 | < 100 ms | load test |
| valid-input errors | 0 | suite |
EOF
put "$A/backlog.md" <<'EOF'
# Backlog

## Backlog
| rank | id | title | persona | value | risk | size hint | state |
|---|---|---|---|---|---|---|---|
| 1 | S-001 | greet by name | visitor | high | low | small | ready |
EOF
sign G0 po docs/agile/vision.md
sign G0 human docs/agile/vision.md --note "operator approved scope"
flow check G0
commit "docs: close G0 scope"
flow advance >/dev/null

say "shaping"
flow next >/dev/null
put "$A/stories/S-001.md" <<'EOF'
# S-001 Greet by name

## Story
As a visitor, I want to be greeted by name, so that the service feels personal.

## Acceptance criteria
- Given a name, When I call GET /greet, Then the response contains "Hello, <name>!".
- Given surrounding whitespace, When I call the endpoint, Then the name is trimmed.
- Given an empty name, When I call the endpoint, Then the response is 400 with "name is required".
- Given a name over 40 characters, When I call the endpoint, Then the response is 400 with "name is too long".

## Non-goals
- Persistence, authentication, and localization.

## Test plan
- Unit: greet success, trim, empty, too long.
- Integration: handler status codes.
- E2E: none, the handler is the boundary.

## Wireframe
- docs/agile/ux/wireframes/S-001.html

## NFRs
- Latency p95 under 100 ms.
- Accessibility: labeled input, AA contrast.

## Open questions
- None.

## Slice
size: small
priority: 1
dependencies: none
EOF
commit "docs: shape S-001"
flow advance >/dev/null

say "ux"
flow next >/dev/null
put "$A/ux/flows.md" <<'EOF'
# Flows

## Flows
- Entry: visitor opens the greeting form.
- Success: greeting appears with the name.
- Empty: prompt asks for a name, primary action disabled.
- Loading: button shows a progress state and is disabled.
- Error: message names the problem and keeps the input.
EOF
put "$A/ux/tokens.json" <<'EOF'
{
  "color": { "surface": "#ffffff", "text": "#111111", "accent": "#0055cc", "danger": "#b3261e" },
  "space": { "sm": "8px", "md": "16px" },
  "font": { "body": "16px/1.5 system-ui" }
}
EOF
put "$A/ux/wireframes/S-001.html" <<'EOF'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Greet</title></head>
<body style="font:16px/1.5 system-ui;color:#111;background:#fff">
  <main>
    <h1>Greet</h1>
    <form>
      <label for="name">Name</label>
      <input id="name" name="name" required>
      <button type="submit">Greet</button>
    </form>
    <section aria-label="Empty state"><p>Enter a name to begin.</p></section>
    <section aria-label="Loading state"><p>Greeting…</p></section>
    <section aria-label="Error state"><p role="alert">Name is required.</p></section>
  </main>
</body></html>
EOF
put "$A/ux/usability-notes.md" <<'EOF'
# Usability notes

- Contrast: #111 on #fff is 18.9:1, passes AA.
- Keyboard order follows visual order.
EOF
commit "docs: ux for S-001"
flow advance >/dev/null

say "architecture"
flow next >/dev/null
put "$A/architecture/system.md" <<'EOF'
# System

## System
One Node HTTP service, no persistence, no external calls.

## Context
Visitor -> service -> JSON response.
EOF
mkdir -p "$A/architecture/c4"
put "$A/architecture/c4/context.md" <<'EOF'
# Context

```mermaid
flowchart LR
  Visitor --> Service
```
EOF
put "$A/architecture/nfrs.md" <<'EOF'
# NFRs

## NFRs
| quality | target | measurement | owner |
|---|---|---|---|
| latency | p95 < 100 ms | load test | sre |
| availability | 99.5% monthly | SLO burn | sre |
EOF
put "$A/architecture/fitness-functions.md" <<'EOF'
# Fitness functions

## Fitness functions
- No new runtime dependency without an ADR: `test -z "$(node -e "console.log(1)")"`.
- Handler stays dependency-free: lint command from the stack profile.
EOF
mkdir -p "$A/architecture/adrs"
put "$A/architecture/adrs/0001-node-http.md" <<'EOF'
# ADR-0001: Node HTTP server

## Status
accepted

## Context
One endpoint, no persistence, zero dependencies preferred.

## Decision
Use the Node standard library HTTP server.

## Consequences
- Positive: no dependency surface, fast start.
- Negative: routing and validation are hand-rolled.
- Follow-up: add a router only if a second endpoint appears.

## Alternatives
- Express: rejected as unnecessary for one route.
EOF
put "$A/architecture/debt.md" <<'EOF'
# Debt

## Debt
| id | debt | incurred by | interest | repayment trigger | owner |
|---|---|---|---|---|---|
| D-001 | hand-rolled routing | S-001 | second route needs edits | second endpoint | tech-lead |
EOF
sign G1 architect docs/agile/architecture/system.md
sign G1 tech-lead docs/agile/architecture/debt.md
sign G1 ux docs/agile/ux/flows.md
sign G1 human docs/agile/architecture/adrs/0001-node-http.md --note "operator approved design"
flow check G1
commit "docs: close G1 design"
flow advance >/dev/null

say "planning"
flow next >/dev/null
put "$A/plan/sprint-01.md" <<'EOF'
# Sprint 01

## Scope
Ship S-001 and verify the greeting path.

## Stories
1. S-001 greet by name

## Non-goals
- Auth, persistence, localization.

## Demo
- Valid name returns a greeting.
- Empty name returns 400.
EOF
sign G2 human docs/agile/plan/sprint-01.md --note "operator approved sprint"
flow check G2
commit "docs: close G2 plan"
flow advance >/dev/null

say "build"
flow next >/dev/null
mkdir -p "$A/build/S-001"
put "$A/build/S-001/plan.md" <<'EOF'
# Build plan S-001

- Files: `src/app.mjs`, `test/app.test.mjs`.
- Seams: `greet()` is pure; `handler()` maps URL to `greet()`.
- Tests: success, trim, empty, too long.
- Risks: unicode length counting.
EOF
put "$A/build/S-001/red.log" <<'EOF'
$ node --test
# tests 4
# pass 0
# fail 4
Error: greet is not a function
EOF
put "$A/build/S-001/green.log" <<'EOF'
$ node --test
# tests 4
# pass 4
# fail 0
EOF
put "$A/build/S-001/review.md" <<'EOF'
# Review S-001

## Verdict
pass

reviewer: reviewer-spawn
implementer: implementer-spawn

- Each criterion has a failing-first test.
- No duplicated rule.
- No new dependency.
EOF
commit "feat: build S-001"
flow advance >/dev/null

say "quality"
flow next >/dev/null
put "$A/quality/test-strategy.md" <<'EOF'
# Test strategy

## Strategy
- Unit: validation and formatting rules.
- Integration: handler status codes.
- E2E: none; the handler is the system boundary.
- Risks: unicode, concurrency, input size.
EOF
put "$A/quality/defects.md" <<'EOF'
# Defects

## Defects
None open.
EOF
commit "docs: quality evidence"
flow advance >/dev/null

say "release"
flow next >/dev/null
put "$A/release/readiness.md" <<'EOF'
# Readiness

## Readiness
- Tests green, coverage on changed code above 80%.
- No open severity 1 or 2 defect.
- Rollback: redeploy previous commit.
EOF
put "$A/release/release-notes.md" <<'EOF'
# Release notes

## Notes
- Added GET /greet.

## Demo
- Valid name returns a greeting.
- Empty name returns 400.
EOF
put "$A/operations/slos.md" <<'EOF'
# SLOs

## SLOs
| service | SLI | SLO | window | error budget | alert burn |
|---|---|---|---|---|---|
| greet | success rate | 99.5% | 30d | 0.5% | 2% in 1h |
EOF
put "$A/operations/load-test.md" <<'EOF'
# Load test

## Load test
- Tool: autocannon, 30s, 50 connections.
- Result: p95 12 ms, 0 errors.
- Headroom: 8x before the latency SLO is at risk.
EOF
sign G3 po docs/agile/release/release-notes.md
sign G3 tech-lead docs/agile/build/S-001/review.md
sign G3 architect docs/agile/architecture/nfrs.md
sign G3 sre docs/agile/operations/slos.md,docs/agile/operations/load-test.md
sign G3 human docs/agile/quality/test-strategy.md --note "operator approved release"
flow check G3
commit "docs: close G3 release"
flow advance >/dev/null

say "operations"
flow next >/dev/null
mkdir -p "$A/operations/runbooks" "$A/operations/alerts" "$A/operations/dashboards"
put "$A/operations/runbooks/GreetErrorRate.md" <<'EOF'
# GreetErrorRate

1. Check the error rate panel.
2. Check the deploy id against the last green build.
3. Roll back if the rate started at deploy time.
EOF
put "$A/operations/alerts/greet.yaml" <<'EOF'
alert: GreetErrorRate
expr: rate(greet_errors_total[5m]) > 0.02
runbook: docs/agile/operations/runbooks/GreetErrorRate.md
EOF
put "$A/operations/dashboards/greet.json" <<'EOF'
{ "title": "greet", "panels": ["latency", "traffic", "errors", "saturation"] }
EOF
sign G4 sre docs/agile/operations/slos.md
flow check G4
commit "docs: close G4 operations"
flow advance >/dev/null

say "retro"
flow next >/dev/null
put "$A/retro/retro-01.md" <<'EOF'
# Retrospective — sprint 01

## What worked
- Gates caught a missing wireframe before build.

## What did not work
- Release evidence was written late.

## What we learned
- Collect SRE evidence during architecture.

## Actions
| Action | Owner role | Story id | Due |
|---|---|---|---|
| Draft SLOs at G1 | sre | S-002 | sprint 02 |
EOF
commit "docs: close retro 01"

say "verify"
(cd "$REPO" && npm test >/dev/null)
node "$CLI" status

echo
echo "flow complete: intake -> retro"
