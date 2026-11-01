# Twenty-repository README navigation boundary verification

Task 059, 2026-11-01. Scope `d78cf9f`, implementation `7d58bf7`. This repeatable
engineering check uses owned synthetic sources and zero model calls. It does not alter
production behavior, frozen model evaluations or consumed qualification receipts.

[Raw measurement](result.json) includes runtime/implementation/source hashes, complete
initial orientation, generation metadata, measured calls/bytes/times and asserted lifecycle
checks. The [independent corpus](../../../fixtures/loredock-readme-boundary/README.md)
specifies the expected ranges before the production projection runs.

## Observations

Twenty root READMEs each contain exactly 32,768 UTF-8 bytes and 960 lines, filling the
655,360-byte orientation input budget. The app returns all twenty original contexts,
240 exact section records, eighty omitted labels and 160 issued original parts. All
labels are 160 bytes, include Unicode and remain exact. Nested sections and omitted
boundary headings retain the independently expected inclusive ranges. All cited parts
reopen with the right source, revision, generation, hash and original text. Independent
raw-result review also confirms all twenty complete reading lists contain exactly eight
parts at lines 1–120 through 841–960.

Fifteen optional manifest reads are visibly omitted by the aggregate byte budget; no
manifest displaces a README. These manifests remain in the source index/search. Section
omission diagnostics count twenty affected documents, with four omitted labels per card.

| Projection | Milliseconds | JSON bytes |
| --- | ---: | ---: |
| First read | 49.53 | 135,560 |
| Repeat 1 | 42.04 | 135,560 |
| Repeat 2 | 36.11 | 135,560 |
| Unchanged refresh | 72.68 | 135,560 |
| Historical index | 65.50 | 135,559 |
| Refreshed index after restart | 62.66 | 135,560 |
| Historical index after restart | 33.04 | 135,559 |

Every measured projection accounts for twenty documents and 655,360 source-input bytes,
opens 160 issued parts, makes zero Git calls and causes zero SQLite writes. Input bytes
are not physical I/O: evidence validation can reread originals. All outputs stay below the
524,288-byte cap. The historical byte difference is the JSON `stale` boolean. Repeated
projections are identical, including input hashes. The first-read latency is below the
prospective one-second analysis trigger; no performance change was needed. Timing was
recorded while local `pnpm check` ran concurrently, so these are descriptive observations,
not isolated-machine benchmarks or an HTTP/UI latency guarantee.

Both generations index 79 files, exclude sixty synthetic canaries and have no failed or
pending files. The second reuses all 79 indexed files. Section vectors retain exact
meaning and revisions while original evidence IDs belong to the new generation. The
older generation remains pinned and explicitly stale; both projections survive restart
exactly. Source heads/worktrees stay unchanged after fixture preparation; no answer
attempt is recorded. The user's running demo and its compiled assets were untouched.

## Reproduction and limits

On Node >=22.13 / pnpm 10.15.0, from a clean committed checkout after `pnpm build`:

```sh
node scripts/loredock-readme-boundary.mjs /absolute/result-directory
```

The script accepts no data/source path. It creates and removes its own twenty-repository
fixture and catalog, retaining only the specified result directory. Use a separate owned
checkout if another process serves your primary checkout's compiled assets. Two ordinary
regression tests verify corpus bytes/lines and all twenty expected section/part vectors.

This covers one deliberately dense boundary shape with a large padding line. It does not
qualify arbitrary Markdown, huge source trees, concurrent HTTP/UI latency, generated
architecture understanding or private-project adoption. The three-source browser evidence
from Task 058 remains separate and unchanged. Broader glossary/synthesis needs its own
contract; current observations do not require another user input form or model call.
