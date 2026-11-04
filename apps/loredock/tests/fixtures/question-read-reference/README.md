# Question read controls and planned deltas

Task 122 preserves accepted source and actual TypeScript output from merge
`25199908923fd75fb0fdb67b1a86b3c6636298eb` before production edits.
`manifest.json` specifies exact source deltas: scoped one/all row accounting,
after-validation evidence text accounting, and internal selection before admission.
New helpers implement per-store synchronous scope ownership and the separately typed
exact-anchor policy. No public request/response, schema, parser or answer changes.

The regression reconstructs old source byte-for-byte by reversing only these deltas,
compiles it independently and verifies emitted hashes. Static import relocation makes
these accepted controls executable against unchanged dependencies. Current parser
identity remains genuine. Task 112's archived Store never calls the new capability;
its frozen dependency closure must remain identical. Task 120's normal test now pins
its old producer against this accepted control plus the explicit production delta,
without rewriting its historical manifest or executing its exhausted library family.
