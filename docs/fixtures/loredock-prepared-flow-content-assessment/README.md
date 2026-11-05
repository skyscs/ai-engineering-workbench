# Retained prepared-context content assessment

The [independent assessor](../../../scripts/loredock-prepared-flow/content-assess.mjs)
measures exact UTF-8 bytes from retained context and witness strings without importing
the candidate producer or codec. It verifies context, witness, prompt and native-item
identities, requires native citations to reference issued original spans, and checks the
frozen prompt, derived-content, original-evidence, witness and preparation limits.
The preparation measurement is the serialized snapshot envelope plus the frozen
1,024-byte reserve. It is logical retained-content accounting, not JavaScript heap size.

Purged witnesses must have null context/witness and zero retained bytes. They still
count toward the 64-row quota. An omitted native item's attempted size remains separate
from its actual retained bytes; a small omitted result cannot satisfy a required useful
native-path case. Content checks alone grant neither source-usefulness nor resource
qualification.

## Actual offline observations

The [ordinary entry](../../../scripts/loredock-prepared-flow/content-assessment-development.mjs)
copies four existing complete catalogs before opening SQLite. No original checkpoint is
opened by SQLite, because even a read-only connection can create sidecar files. All input
hashes remain unchanged. The cases run in the fixed order below:

| Retained catalog | Rows | Purged rows | Witness bytes |
| --- | --- | --- | --- |
| Three warm answers | 3 | 0 | 199,008 |
| Twenty-answer checkpoint | 20 | 0 | 1,326,720 |
| Sixty-four-answer checkpoint | 64 | 0 | 4,245,504 |
| Recovered purge | 64 | 64 | 0 |

All 87 nonpurged witnesses have the same observed content sizes:

| Metric | Measured | Frozen limit |
| --- | --- | --- |
| Witness row | 66,336 bytes | 786,432 bytes |
| Serialized preparation with reserve | 91,335 bytes | 1,048,576 bytes |
| Prompt | 23,232 bytes | 98,304 bytes |
| Native and legacy derived content | 7,519 bytes | 8,192 bytes |
| Original evidence | 2,259 bytes / 11 spans | 65,536 bytes / 30 spans |

The earlier cold preparation and all three warm reviews share the exact reviewed hash
`8aa75b743c5266d208917b159966d20dca5b0dc349929829623d296c92f758a1`.
Their public context, compact result, selection and prompt version match the retained
witness. This binds snapshot content; it does not attribute each transient preparation
to the particular answer row selected as its matching reference. No new preparation,
answer admission, controlled runtime, model call or reserved-family candidate read occurs.

The owner exits 0 with no errors or surviving descendants. All four content assessments
pass. Independent retention inspection copies all four catalogs again, verifies integrity
and foreign keys, checks the 87 witnesses and 64 tombstones, binds four reviews and 18
reused input files to earlier committed inventories, and preserves the raw output tree.
The zero-byte purge does not free capacity.

## Validation and remaining scope

[records.json](records.json) binds complete catalog copies, original input inventories,
raw results, helper sources and logs. Five focused controls cover UTF-8/escaped envelope
accounting, inclusive prompt/evidence bounds, oversized omitted content, identity/citation
corruption, and purged/duplicate/inconsistent rows. Installation, production builds and
the original application/input seal pass; both full final-head CI events remain required.

These reused ordinary catalogs cover their own exact retained content. They do not
establish unseen transient bytes for every preparation in R01-R15, continuous memory
bounds, operation lifetime/work coverage or the final ordered matrix. Earlier timer,
browser RSS/cadence, list-work and required-native-path failures remain failed. The
final executable/environment/output seal is still pending, and model eligibility is closed.
No application, parser, schema, frozen input/oracle/threshold or user-demo change occurs.

The preceding owner/storage checkpoint is accepted through
[PR #153](https://github.com/skyscs/ai-engineering-workbench/pull/153): push 42050157252
and pull_request 42050986144 pass 996 tests at exact head
`fb8e03bac60916a75a43695a9cef23f93ea7dcd2`. Merge
`909ca29f5c23f5ede70097739ac8e9d874278ee6` has the identical tree. Both CI logs are retained here.
