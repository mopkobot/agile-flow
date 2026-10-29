# Changelog

All notable changes to this project are documented here. Format follows Keep a Changelog; versioning follows SemVer.

## [Unreleased]

### Changed

- The build loop is now RED, GREEN, REFACTOR: `agile-dev` has a refactor mode between implementer and review, writes `build/<story-id>/refactor.log`, and records a reasoned `no refactor:` line when nothing needs restructuring.
- G3 requires `build/*/refactor.log`, accepts a clean suite or a reasoned "no refactor", and rejects a refactor log that shows a red suite.
- The tech lead refuses to approve a story whose refactor step is missing or unexplained.
- The build loop spawns `agile-tech-lead` in review mode for `review.md`; it no longer claims a nonexistent `agile-dev` reviewer mode. The reviewer is never the implementer.

## [1.0.0] - 2026-10-28

First published release.

### Added

- Ten skills: orchestrator, PO, BA, UX, architect, tech lead, dev, QA, SRE, auditor.
- Hard gates G0–G4 and per-story DoR, with structural, executable, and sign-off validation.
- Role boundaries enforced against a stage base, with no self-approval of another role's work.
- TDD evidence rules: separate test-author and implementer spawns, RED and GREEN logs, reviewer identity.
- Human passphrase authentication and expiring per-role tokens.
- Independent claim audit at release and go-live, plus citation requirements for reviews, QA evidence, and NFRs.
- Standing tech-debt allocation enforced at planning and verified at release.
- Story claims for parallel agents, serialized state writes with revision checks.
- GitHub tracker sync for status labels and issue bodies.
- Retro loop that turns actions into skill changes, cards, or debt rows, with recorded human approval.
- Brownfield harness assessment with a fix per gap.
- Greenfield and brownfield end-to-end fixtures, including a real second sprint.
- CI on Node 20 and 22.
- Repository harness: `AGENTS.md`, `CLAUDE.md`, product note, architecture note, reliability signals, PR template.

### Known limits

- Same-user isolation is not a security boundary; an agent with the human passphrase can mint tokens.
- Auditor independence is enforced by spawn discipline, not cryptography.
- Maven integration runs only where `mvn` is installed.
