# Independent native assessment verification

Task 108 adds a [pure offline native assessor](../../../scripts/loredock-native-assessment/README.md)
with separate integrity, shape, expected source support, usefulness, historical equality
and raw comparison results. It imports no production decoder or service and does not
interpret current source authorization. No application source or old measured file changes.

Ten focused cases/subcases exercise two fresh owned four-source examples and saved-copy
mutations, including 25 unknown structured-field targets, 17 rehashed corruptions,
malformed UTF-8/JSON/depth, unsafe artifact reads, missing denominators and independently
pinned policy. Review also covers a complete topic literal with a trailing newline.
All **791 strict tests/builds** pass. The initial eight-case/789-test runs also passed;
the two review additions expose stricter checks without rewriting earlier outcomes.

The actual compiled producer passes all eight functional operations for both examples.
The complete case captures 35,472 bytes; the incomplete consumer captures 26,552 bytes.
Both preserve exact authorized history after restart and two inventory replacements.
The incomplete case passes its explicit gap oracle and fails the complete-flow oracle.
No model calls or user data are involved.

The [manifest](validation.json) records nine command logs, 34 compiled raw/input/report
artifacts, hashes, source modules and remaining limits. Each file is separately gzipped;
its decompressed bytes match the original SHA-256 and size. To assess an unpacked copy,
rebase only the input object's `root` to the owned unpacked case directory. The assessor
uses its relative `raw/*.json` references and expected corpus/pins, never source checkout
paths or a service-returned arbitrary filename. Artifacts were retained before assessment.

All planned content dimensions remain present when another fails. Raw equality can pass
for identical unsupported bytes but cannot make the overall result pass. Offline shape
checks do not establish runtime coherence, current source access or semantic acceptance.
This is separate implementation and expected data, not independent human review. No
resource family or cross-process qualification was run; Task 109 implements that driver
before a fresh final family. Historical negative gates remain unchanged.
