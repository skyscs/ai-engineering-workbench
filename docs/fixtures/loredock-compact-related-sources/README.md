# Compact related-source cards

Task 040 follows merged PR #43 (`ad6a0e4`). The scope was recorded in `f140e87`.
The related-source view now starts with native expandable source cards. Closed summaries
show each source, the kind of clue, distinct relationship subjects and unverified status.
Repeated subjects are combined in the summary; all individual relationships, originals,
revisions, scope, gaps and omission counts remain available inside the card.

[Browser verification](browser-result.json) ·
[Task](../../../tasks/040-loredock-compact-related-sources.md) ·
[Usage](../../loredock/USER_GUIDE.md#find-candidate-repositories)

Frontend strict typechecking/build and the final owned browser smoke pass. The browser
opens a source card and original evidence by keyboard, verifies both Dojo caller/route
originals, escaped primary/linked labels and visible subjects before expansion, and
retains question/index/review/revocation/policy response fences. Both summary and detail
views fit a 390 px viewport without horizontal overflow. Source cards reset to collapsed
when a new preview is requested; native details need no extra toggle state.

Candidate selection/order, original support, parser/API/storage/runtime behavior and
all qualification reports are unchanged. The existing 22/22 observed repository recall
still has five over-wide scopes and does not establish automatic routing or L5 acceptance.
No model calls or corporate sources were used. Browser runs remain sequential because
they own port 4244 and temporary synthetic data.
