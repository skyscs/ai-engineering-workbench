# Answer witness storage controls

Task 124 preserves accepted source/emitted controls from Task 123 merge `da7122b`
before production edits. The manifest declares exact Store and legacy Answers deltas.
All other application modules, including parser and prepared context/witness code,
remain unchanged. New storage/schema modules are internal only; no public consumer.

The maintenance scripts are copied separately before their schema/report extension.
The durable contract is hashed before implementation. Old source pins, raw records,
compiled runtime archives and exhausted inputs must not be rewritten. Regression
adapters may normalize only these exact additional deltas to prove the original pins.

The genuine older runtime remains the existing 37-module archive, with its actual
fingerprint. Use it to create old state and prove forward migration and explicit
schema-11 refusal, not to claim backward application compatibility.

The normal analysis-write comparison loads a hash-pinned copy of the unchanged old
harness and requires exactly one extra schema-11 witness purge execution on revocation.
All raw query traces retain that execution; every other statement and retained inventory
state must match. The original harness and its archived results remain unchanged.
