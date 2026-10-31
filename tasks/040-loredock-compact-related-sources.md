# Task 040 — Compact related-source reading cards

Status: scoped before implementation. Follows Task 039 / merged PR #43 (`ad6a0e4`) and its code-adapter v3 evidence.
The owner authorized continuing the sequence with synthetic inputs only.

## Problem

Expanding Related repositories currently opens every retained relationship at once.
Repeated reasons, scope notes and original references can consume multiple screens before
another source becomes visible, especially on mobile. Preserve that evidence while making
source choice easier to scan.

## Scope

Use a native expandable card for each additional source. Its closed summary shows the
source name, the relationship subject(s), the kind of clue and visible unverified status.
Opening a source reveals the existing revision, full relationships, both endpoint controls,
auxiliary originals, gaps and omission counts. Keep source order, budgets, candidate
selection, primary suggestions, other matches and all backend data exactly as they are.

No custom toggle state or new controls/settings are needed. The complete related section
and each source start collapsed on a fresh preview. Input/index/source/policy/review
fences remain in the parent. Labels and subjects use escaped text, and long values wrap.

## Acceptance

- Source subjects distinguish examples such as /legacy/orders and /stock/reservations
  before opening their detailed evidence; no reason or uncertainty is dropped.
- Browser acceptance opens a source using the keyboard, then opens original evidence
  with keyboard focus preserved. Verify escaped labels, 390 px summaries/detail layout,
  original Dojo caller/route support and existing response/revocation/history fences.
- Run relevant frontend type/build checks and the sequential owned browser smoke; do not
  add implementation-mirroring unit tests for this reversible presentation change.
- Update usage and current status, retain the verification report, review the diff and
  merge after both exact-head CI checks pass, then continue the authorized sequence.

No ranking, parser, API, storage, model, corporate-source or acceptance-gate change.
