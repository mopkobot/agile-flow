# Legacy Greeting

Brownfield fixture. Same endpoint as `sample-app`, with two deliberate legacy problems:

1. The name-length rule is duplicated: `greet()` rejects over 40 characters, `handler()` rejects over 50.
2. Neither limit is covered by a test, so the divergence is invisible to the suite.

The brownfield run must surface both in `architecture/legacy-assessment.md` and in the debt register before any story is built.

Run: `npm test`, `npm start`.
