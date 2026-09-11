# Investigation report — version 1

- Title at run time: Release single investigation
- Task ID: 94571c02\-4833\-44be\-89a1\-bb0806eb7e5b
- Report ID: cd6799f3\-5156\-4ee1\-816d\-5f1cf537a134
- Root cause ID: 2e51a300\-dd2a\-4db0\-a854\-d65b6fa2e40a
- Stage run ID: 1fd1b888\-083a\-41df\-9987\-72691d75c198
- Published: 2026\-09\-11T10:20:47\.994Z
- Exported: 2026\-09\-11T10:20:48\.179Z
- Lifecycle at export: active
- Freshness at export: fresh
- Context revision: 3
- Previous report ID: Not recorded
- Triggering intervention ID: Not recorded

## Runtime provenance

- Runtime: codex\-cli
- Connection ID: b22e1435\-9e29\-477b\-821b\-d9bcfb93e92d
- Model profile ID: 3df271a7\-127e\-42d2\-b5b2\-973c9862e869
- Requested model: gpt\-5\.6\-terra
- Requested reasoning effort: medium
- Prompt version: investigation\-v2
- Schema version: investigation\-v1
- Recorded CLI version: codex\-cli 0\.154\.0

## Task description at run time

> Investigate why a 1999\-cent item with a 15% discount now charges 1700 cents instead of 1699\. Inspect source and Git history; distinguish the introducing change from later documentation\. Use the incident log\. Do not implement a fix\.

## Constraints at run time

No active constraints were recorded.

## Selected repository pins

- ef414202-9ae8-471f-9fde-1ba6c9d40b07: e2dae9c8e8e9575063be8354edce3d229e41cac3

## Selected artifact ranges

- Artifact ID: 69f7febf\-4316\-4dee\-9054\-6f1278a5fd94
- SHA-256: dfe2493dcf40f0a272b712cd827bf992794d11d69d662d0dbcf463f1c8b9cba5
- UTF-8 byte range: \[0, 122\)

## Investigation

> The incident log reports that 1999 cents at 15% should produce 1699 cents but produces 1700 \(e1\)\. Git history shows the prior implementation applied the percentage before a single final rounding \(e2\)\. The subsequent refactor changed the order to round the whole\-dollar value first \(e3, e4\)\. The pinned commit after that is documentation\-only and does not modify the calculation \(e5, e6\)\.

## Historical timeline


> Commit 2c0b8ec introduced the discount calculation as \`Math\.round\(cents \* \(100 \- percent\) / 100\)\`, which for 1999 and 15 evaluates \`Math\.round\(1699\.15\)\` to 1699\.

- Evidence IDs: e2

> Commit b8a5515 changed the expression to \`Math\.round\(cents / 100\) \* \(100 \- percent\)\`\. For the incident input, this rounds 19\.99 to 20 before multiplying by 85, yielding 1700; this is the introducing change\.

- Evidence IDs: e3, e4, e1

> Commit e2dae9c was later and documentation\-only: it added audit\-field documentation, while the pinned source retains the refactored calculation\.

- Evidence IDs: e5, e6, e4

## Root cause

- Conclusion: identified

> The defect was introduced by commit b8a5515dea164ac92a65fee7337c7e1a9bee4bca, which moved rounding from the final discounted\-cent result to the pre\-discount dollar value\. That premature rounding converts 1999 cents to 20 before applying the 15% discount factor, producing 1700 instead of rounding the discounted 1699\.15\-cent result to 1699\.

- Evidence IDs: e1, e3, e4

## Unresolved questions

None reported.

## Evidence locators

### e1


> Incident log specifying the input, expected total, observed total, and absence of quantity, tax, or currency\-conversion effects\.

- Kind: artifact
- Artifact ID: 69f7febf\-4316\-4dee\-9054\-6f1278a5fd94
- SHA-256: dfe2493dcf40f0a272b712cd827bf992794d11d69d662d0dbcf463f1c8b9cba5
- Byte start (inclusive): 0
- Byte end (exclusive): 122
- Source at export: Available; locator rechecked

### e2


> Pre\-refactor discount implementation, applying the percentage before final rounding\.

- Kind: repository\_file
- Repository ID: ef414202\-9ae8\-471f\-9fde\-1ba6c9d40b07
- Commit SHA: 2c0b8ecb6991d4837619dc84539c5c96b0df2251
- Repository-relative path: price\.mjs
- Line start: 1
- Line end: 3
- Source at export: Available; locator rechecked

### e3


> Refactor commit that changed the ordering of rounding and discount multiplication\.

- Kind: git\_commit
- Repository ID: ef414202\-9ae8\-471f\-9fde\-1ba6c9d40b07
- Commit SHA: b8a5515dea164ac92a65fee7337c7e1a9bee4bca
- Source at export: Available; locator rechecked

### e4


> Pinned implementation showing rounding of cents divided by 100 before multiplication by the discount factor\.

- Kind: repository\_file
- Repository ID: ef414202\-9ae8\-471f\-9fde\-1ba6c9d40b07
- Commit SHA: e2dae9c8e8e9575063be8354edce3d229e41cac3
- Repository-relative path: price\.mjs
- Line start: 1
- Line end: 3
- Source at export: Available; locator rechecked

### e5


> Later pinned documentation commit, whose recorded change affects only audit\.md\.

- Kind: git\_commit
- Repository ID: ef414202\-9ae8\-471f\-9fde\-1ba6c9d40b07
- Commit SHA: e2dae9c8e8e9575063be8354edce3d229e41cac3
- Source at export: Available; locator rechecked

### e6


> Audit documentation added by the later commit; it describes audit fields and contains no pricing logic\.

- Kind: repository\_file
- Repository ID: ef414202\-9ae8\-471f\-9fde\-1ba6c9d40b07
- Commit SHA: e2dae9c8e8e9575063be8354edce3d229e41cac3
- Repository-relative path: audit\.md
- Line start: 1
- Line end: 1
- Source at export: Available; locator rechecked

## Limitations

This is an AI-generated explanation for human review. Locator validation does not prove causality.
Sources were validated at publication. Availability above is checked during export and can change afterward.
Lifecycle and freshness describe export time. The report content and input provenance describe its original run.
Source bodies, executable/configuration paths, configuration fingerprints and raw diagnostics are omitted.
Known credential patterns, URLs and absolute paths in prose are redacted. Review before sharing: this is not a complete secret scanner.
Untrusted prose is escaped as text. Requested settings do not certify provider/account identity or exact outbound data.
