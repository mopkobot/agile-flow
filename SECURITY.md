# Security

## Reporting

Report gate bypasses, boundary escapes, token or passphrase weaknesses, tracker credential leaks, or prompt-injection paths privately to the repository owner through GitHub's private vulnerability reporting. Do not open a public issue first.

Include: the command or skill involved, the expected behavior, what happened instead, and a minimal reproduction against a scratch repository.

## Threat model, in brief

The flow runs as the same OS user as the agent. It defends against:

- Accidental scope creep and role substitution.
- Unreviewed or uncited claims reaching release.
- Stale concurrent writes.
- Casual token reuse across roles, and expired tokens.

It does not defend against a same-user agent that has the human passphrase. If an agent can read your environment, it can mint role tokens. Treat the passphrase as a human-held secret, issue tokens per spawn, and keep them short-lived.
