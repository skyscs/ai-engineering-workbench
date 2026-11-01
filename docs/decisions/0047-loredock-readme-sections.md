# ADR 0047 — Original README section navigation

## Status

Accepted for Task 058 implementation, 2026-11-01. This extends source orientation;
it does not establish system understanding, answer quality or private-pilot acceptance.

## Decision

Reuse the complete, already authorized and validated root README from the orientation
projection. Add a small conservative ATX selector without a Markdown rendering/parser
dependency. Orientation schema v2 / adapter v3 carries literal titles, heading levels,
inclusive source ranges and every issued evidence ID overlapping each section. Evidence
chunks remain unchanged; they can include neighboring sections. The final newline does
not create a line beyond the issued original. No additional document/Git/model reads,
persisted schema, code parser fingerprint, answer prompt or retrieval changes are needed.

Recognize one to six `#` markers with at most three leading spaces and a whitespace/end
delimiter. Strip only opening/optional closing marker syntax and surrounding whitespace;
leave inline markup literal. Exclude fenced/indented code and quote/list-contained headings.
Fence closers need matching characters, sufficient length and no trailing non-whitespace.
Conservatively skip HTML-looking blocks, comments, processing instructions, declarations
and raw script/style/pre/textarea content. The selector can omit headings around unusual
HTML/list layouts; it is deliberately not a full CommonMark outline. Setext headings are
outside the profile. All source content remains available through existing reading links.

A section ends immediately before the next recognized same/higher-level heading, so a
parent includes its children. Empty/oversized/over-count headings still set boundaries.
List at most twelve original labels per file, each at most 160 UTF-8 bytes, in source
order, with whole-label omission counts. Existing twenty-source, sixty-document, 32 KiB
per-file, eight-span, 640 KiB input and 512 KiB output budgets remain in force. This is
navigation metadata, not a new claim/relationship, glossary or architecture model.

Each card adds a collapsed **Browse README sections** disclosure with escaped labels,
line ranges and explicit original-part buttons. Existing evidence focus and selected
index/source/policy response fences apply. Keep introductory context, complete reading,
coverage, uncertainty and historical identity visible. No extra user setup is introduced.

## Verification and isolation

Unit/integration checks cover syntax boundaries, omissions, exact original coverage,
multiple chunks, read-only/Git-free projection, historical refresh/restart and source/
policy fencing. Existing corrupt-evidence and HTTP/session checks remain applicable.

The opt-in browser smoke uses three generated repositories and compiled production UI/
HTTP middleware. An owned ephemeral HTTP proxy dispatches requests directly to its own
in-process app, with no upstream forwarding or port-4244 listener. Chrome's explicit
loopback bypass override keeps the ordinary application origin/CSRF/CSP contract intact;
a unique sentinel verifies the transport before application navigation. See Chromium's
[manual proxy bypass documentation](https://github.com/chromium/chromium/blob/main/net/docs/proxy.md).
The fresh profile, proxy, database and repositories are cleaned up afterward. Held real
browser responses test index/source/evidence fences; desktop/mobile screenshots and raw
results remain reviewable. The existing user demo and its compiled assets are untouched.
