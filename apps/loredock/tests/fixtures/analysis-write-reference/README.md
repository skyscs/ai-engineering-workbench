# Analysis write behavior before scoped reuse

These two original modules come from `d356a8c03e8605cada35a2c46db1b5f7b21fcf65`,
before Task 112 changes production behavior. `store.ts.txt` and `code-analysis.ts.txt`
retain exact source bytes. The manifest pins TypeScript 5.9.3, compiler options,
emission, explicit import relocation, both executable variants, 22 unchanged source
dependencies and external imports. Ordinary tests verify the entire closure without
Git history, network or older worktrees.

The `.mjs` variant imports current source dependencies through the ordinary test
loader; `.compiled.mjs` imports the corresponding actual emitted application modules
for plain-Node compiled regression. Both originate from the same archived source and
change only declared import paths. No production module imports this fixture.

The unchanged fingerprint provider deliberately computes the current implementation
identity. This is an independent prior-behavior control against the same test identity
basis, not a historical installed runtime replay. Real production analysis changes
must still invalidate old fingerprints and require explicit reanalysis. Instantiate
controls with separate stores/catalogs; the facade does not assert shared private
ownership. Do not regenerate this control to silence a future behavioral mismatch.
