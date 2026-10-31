# ADR 0032 — Literal-reference expansion with direct-query priority

Status: implemented for Task 029, 2026-10-31. Extends ADR 0030.

## Problem and decision

Task 028 found two repeatable reference-recall misses. Common identifiers could consume
the expansion allowance, while all expanded candidates preceded later direct matches.
The existing identifier regex also missed quoted single-word owners such as
`"Journal.append"`. An independent cross-source handler test failed on v6 before tuning.
These are retrieval hints; they do not establish executable calls or relations.

Retrieval `fts-question-v7` retains the same FTS queries and bounded seed reads:

1. Inspect at most six strongest lexical spans, checking byte metadata before evidence
   reads and admitting at most 64 KiB of inspected text. Extract the existing camel-case
   and uppercase-underscore identifiers, bounded to eighty characters. Also extract the
   owner of a complete single-, double- or backtick-quoted `Type.member` or
   `Type.member.member` reference. Owners begin with an ASCII uppercase letter; unquoted
   calls, arbitrary prose words and computed module names do not gain new owner hints.
2. Group hints by source in first-seed order. Within each source, prefer more exact
   query-word matches after search normalization, then qualified owners, then occurrence
   across distinct seed passages, then identifier name. Repetition within one passage
   does not increase its count. Take source turns until twelve unique terms are selected.
   IDs group evidence but never determine ordering; the input source order still matters.
3. Preserve the six strongest direct matches, bounded named-source samples and README
   prefix. Then admit **two distinct direct candidates per expanded candidate**, retaining
   each queue's FTS order. Duplicates consume no turn; when one queue ends, drain the other.
   This gives the user's question priority while retaining bounded discovery opportunities.
   Keep the same zero-hit fallback. Final limits remain 120 candidates, thirty whole spans,
   64 KiB source text and a separately enforced 96 KiB complete prompt.

No repository/fixture names, expected propositions or oracle data enter selection. There
is no recursive expansion, new model call, new UI setting or source execution. Byte,
integrity, authorization, review and freshness checks remain in their existing paths.

## Experiments and limits

[Recorded comparisons](../fixtures/loredock-reference-retrieval/README.md) disclose two
rejected admission variants. Equal direct/expanded turns reached 23/24 prospective and
19/20 original expanded cases; expansion-first reached 22/24 and 20/20. The chosen
direct-priority rule reaches 24/24 and 20/20, plus 20/20 on the original three-source
pilot. Fresh identities preserve selected locators and no-hit orientation. None of these
questions is held out for retrieval; these small synthetic measurements do not establish
optimal weights, multilingual retrieval, framework coverage or private-project readiness.

The first-six seed limit can miss useful references; text hints may be irrelevant or
adversarial, shared field names remain noisy, and direct priority can defer a genuinely
useful expansion. Source turns are only an expansion opportunity, not final source quotas
or guaranteed system coverage. No cap is enlarged to hide omissions. Review each answer's
actual support, including equivalent evidence beyond a chosen evaluation reference.

Schema `cited-answer-v3`, prompt `loredock-answer-v8`, database schema and runtime settings
stay unchanged. Existing contexts/results retain their recorded version and exact bytes;
new contexts use v7 and therefore a different input hash. Historical recall/semantic
artifacts are preserved. Task 027's expanded semantic gate remains failed until a separate
prospective real-model assessment; successful retrieval cannot inherit earlier scores.
