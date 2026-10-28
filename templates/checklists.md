# Ready and Done checklists

## Definition of Ready

A story may enter `docs/agile/stories/` as ready only when every box is true.

- [ ] Story template complete: persona story, Given/When/Then criteria, non-goals, test plan, wireframe, NFRs, open questions, slice.
- [ ] BA sign-off: acceptance criteria complete, edge cases named, NFRs measurable.
- [ ] UX sign-off: wireframe attached, empty/loading/error/success states described.
- [ ] SRE sign-off: operability, SLO impact, failure modes, on-call cost stated.
- [ ] Tech lead sign-off: feasible, slice size small or medium, debt impact stated.
- [ ] PO priority recorded.
- [ ] No blocking open question.

## Definition of Done

A story is done only when every box is true.

- [ ] Acceptance criteria verified by an automated test.
- [ ] Changed-code coverage at least 80%.
- [ ] Lint clean.
- [ ] No new vulnerabilities.
- [ ] Docs updated.
- [ ] Observability hooks present.
- [ ] Mockups honored.
- [ ] No unowned technical debt added; debt register updated.
- [ ] CI green on trunk.
- [ ] RED evidence and GREEN evidence recorded in `docs/agile/build/<story-id>/`.
- [ ] Reviewer verdict `pass` in `docs/agile/build/<story-id>/review.md`.
