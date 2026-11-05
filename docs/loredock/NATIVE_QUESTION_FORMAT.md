# Versioned native question format

New Ready reviews record `loredock-prepared-answer-v2` and, when present,
`native-question-item/2`. Its lexical hash is the enclosing context's `inputHash`.
Duplicate clue tuples contain legacy-comparison and native-edge indexes; a header
reference contains only `legacyHeader`, an index into the same context's comparisons.
All referenced endpoints, status, original support and header content must match.
Unmatched headers remain inline. These indexes are never citations.

Saved v1 answers retain their exact item, prompt, hashes and response bytes. History,
full validation and replay select the stored supported version; unknown or mixed
versions fail explicitly. Source-only inputs retain their recorded prompt version.
No database migration is required. Ready and saved browser displays resolve references
against their matching enclosing context and retain the complete header explanation.
The 8 KiB combined derived and 96 KiB prompt limits remain unchanged. See
[ADR 0061](../decisions/0061-loredock-native-question-format-v2.md) and the
[first ordinary result](../fixtures/loredock-native-format-v2/README.md).

The original protected routes and lifecycle contract remain in
[PREPARED_QUESTION_API.md](PREPARED_QUESTION_API.md). Its frozen bytes are unchanged.
