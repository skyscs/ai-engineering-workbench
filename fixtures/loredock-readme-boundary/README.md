# Twenty-source README navigation boundary input

Task 059 defines repeatable engineering verification with no model calls. The corpus
module constructs a 32,768-byte, 960-line UTF-8 README for each synthetic source. It
replaces only README files in a fresh temporary scale fixture; all frozen corpora,
reports and consumed evaluation budgets remain unchanged.

Each document contains twelve accepted 160-byte labels. Explicit independent expected
ranges include nesting and evidence boundaries at 119/121, 240/241 and later lines.
Four omitted headings exercise the count cap, empty label and oversized Unicode label;
those at lines 721 and 800 still close earlier sections. Apparent headings in a four-
backtick fence (with an insufficient three-backtick closer) and a comment are excluded.
Line 950 pads the file to the byte boundary without adding a heading or another line.

Twenty files fill the existing 655,360-byte orientation input budget. Expect twenty
contexts, 240 exact sections, eighty omitted labels and 160 original spans. Manifest
reading can be omitted by the aggregate budget; root README coverage must remain complete.
This is one constructed boundary shape, not evidence of real-project documentation quality.
No production selector is used to construct the oracle.

See the [task contract](../../tasks/059-loredock-readme-boundary.md). The compiled
measurement uses the current application, checks every original part, records three
latencies, refresh reuse and historical/restart identity, and retains implementation/
runtime/source hashes. The input is repeatable and is not a one-attempt model evaluation.
