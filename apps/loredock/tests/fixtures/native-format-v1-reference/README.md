# Native question v1 compatibility reference

These exact source and emitted files were copied from accepted merge `d43cb05`
before Task 133 production edits. `manifest.json` records their unchanged bytes.
`deltas.json` declares the source edits that introduce explicit v1/v2 dispatch and
the matching browser context. The verifier reconstructs these changes and independently
emits both versions before returning historical bytes to older source checks.

The complete synthetic item and snapshot were first observed at `9890186` using
the prospective ordinary baseline. `baseline.json` records their hashes. This is
the complete new observation, not a reconstruction of the discarded Task 128 item.
The v1 control loads the exact old version constants as well as the old serializer;
it must not silently import the current v2 constant. Other dependencies stay current
only where their bytes and behavior are unchanged by Task 133.
