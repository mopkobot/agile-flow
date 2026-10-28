# Postmortem — <incident title>

Date: <YYYY-MM-DD>
Severity: <SEV1|SEV2|SEV3>
Duration: <start — end, total>

This postmortem is blameless. No individual blame. Describe systems, incentives, and decisions.

## Timeline

| Time | Event | Evidence |
|---|---|---|
| <time> | <what happened> | <log, metric, deploy id> |

## Impact

- Users affected: <number or scope>
- SLOs breached: <name, budget consumed>
- Data impact: <none|describe>

## Contributing causes

- <cause, using "the system allowed" framing>

## What went well

- <detection, mitigation, communication>

## Actions

| Action | Owner role | Type | Due |
|---|---|---|---|
| <fix or guard> | <role> | prevent|detect|mitigate | <date> |

## Detection

- Time to detect: <duration>
- Time to mitigate: <duration>
- Alert that fired, or the gap that delayed detection: <name or description>
