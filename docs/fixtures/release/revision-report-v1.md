# Investigation report — version 1

- Title at run time: Release revision investigation
- Task ID: 881a73b9\-c22b\-4da7\-86fb\-799967bcdc1b
- Report ID: e44bd2c7\-c088\-4dbf\-8779\-c5d8d4c3a20c
- Root cause ID: aa3df1a0\-e527\-48f4\-a7f2\-266ea17bcb08
- Stage run ID: 7172ed71\-9451\-490a\-bc1d\-8a6c1e71b861
- Published: 2026\-09\-11T10:41:13\.775Z
- Exported: 2026\-09\-11T10:41:13\.970Z
- Lifecycle at export: active
- Freshness at export: fresh
- Context revision: 1
- Previous report ID: Not recorded
- Triggering intervention ID: Not recorded

## Runtime provenance

- Runtime: codex\-cli
- Connection ID: 8c4199d8\-fb1f\-47c3\-b2cf\-1378b6395a04
- Model profile ID: 8bb408ea\-4d1a\-4113\-bf4f\-56699f36745f
- Requested model: gpt\-5\.6\-terra
- Requested reasoning effort: medium
- Prompt version: investigation\-v2
- Schema version: investigation\-v1
- Recorded CLI version: codex\-cli 0\.154\.0

## Task description at run time

> Support reports an incorrect product title after a rollout\. They suspect the recent display refactor, but provided no affected tenant, SKU, flag values or request sequence\. Investigate the available history, distinguish demonstrable code defects from the unverified cause of this incident, and record what evidence is missing\. Do not claim an incident cause without the missing observations\. Do not implement a fix\.

## Constraints at run time

No active constraints were recorded.

## Selected repository pins

- 0bde177c-7c55-40a7-b82b-5762a9495a1e: bbcc3e80f4fce31f9de1c27a09f737a090c369da

## Selected artifact ranges

No artifact text was selected.

## Investigation

> The supplied history demonstrates a title\-isolation defect introduced by the cache\-key refactor, not by the later display\-flag refactor\. The current cache is keyed only by SKU even though the repository’s stated requirement says different tenants may assign different titles to the same SKU\. This permits a title loaded for one tenant to be returned to another tenant with the same SKU\. However, no tenant, SKU, cache lifetime, flag values, request ordering, or observed response was provided, so the available evidence cannot establish that this defect caused the reported rollout incident\. The display refactor only adds \`false\` as the default for an omitted uppercase argument; it does not select or cache product titles\.

## Historical timeline


> The initial title\-cache implementation used a composite tenant\-and\-SKU cache key, preserving tenant separation\.

- Evidence IDs: e1

> The cache\-key refactor changed the key from \`$\{tenant\}:$\{sku\}\` to \`sku\`, removing tenant identity while retaining a process\-wide map\.

- Evidence IDs: e2

> At the pinned revision, the cache still uses only \`sku\`; its documented requirement explicitly says cached titles must not cross tenants\.

- Evidence IDs: e3, e4

> The later display refactor changed only the default value of the \`uppercase\` parameter\. It operates on an already supplied value and contains no title lookup or cache\-key logic\.

- Evidence IDs: e5, e6

## Root cause

- Conclusion: insufficient\_evidence

> A concrete code defect is identified: after \`1c870bc38de9e1a458a2111a164bc50d06860de4\`, requests for the same SKU from different tenants share one cached title, so the first loaded tenant title can be returned for another tenant\. This mechanism is consistent with an incorrect product title, while the display refactor is not supported as the selection/caching cause\. Incident causation remains unconfirmed because the reported case lacks the runtime observations needed to show that a cross\-tenant SKU collision and cache\-hit sequence occurred\.

- Evidence IDs: e2, e3, e4

## Unresolved questions


> Which tenant and SKU displayed the incorrect title, and what title was expected versus returned?


> Did another tenant request the same SKU earlier in the same cache/process lifetime, and what title did its loader return?


> Which deployed revision and runtime instance handled the affected requests?


> What were the display flag values and request sequence for the incident?


## Evidence locators

### e1


> Pre\-refactor cache implementation keys titles by both tenant and SKU\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: 9e14bda54fbf486dc297d2e54cce4ff7c0c572bc
- Repository-relative path: cache\.mjs
- Line start: 1
- Line end: 6
- Source at export: Available; locator rechecked

### e2


> Cache\-key refactor removes tenant identity from the key\.

- Kind: git\_commit
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: 1c870bc38de9e1a458a2111a164bc50d06860de4
- Source at export: Available; locator rechecked

### e3


> Pinned cache implementation stores and retrieves titles using SKU alone\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Repository-relative path: cache\.mjs
- Line start: 1
- Line end: 6
- Source at export: Available; locator rechecked

### e4


> Repository documentation states that tenants can use the same SKU for different titles and cached titles must not cross tenants\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Repository-relative path: README\.md
- Line start: 1
- Line end: 1
- Source at export: Available; locator rechecked

### e5


> Display refactor changes the uppercase argument to default to false\.

- Kind: git\_commit
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Source at export: Available; locator rechecked

### e6


> Pinned display function only transforms the provided value based on the uppercase flag\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Repository-relative path: view\.mjs
- Line start: 1
- Line end: 3
- Source at export: Available; locator rechecked

## Limitations

This is an AI-generated explanation for human review. Locator validation does not prove causality.
Sources were validated at publication. Availability above is checked during export and can change afterward.
Lifecycle and freshness describe export time. The report content and input provenance describe its original run.
Source bodies, executable/configuration paths, configuration fingerprints and raw diagnostics are omitted.
Known credential patterns, URLs and absolute paths in prose are redacted. Review before sharing: this is not a complete secret scanner.
Untrusted prose is escaped as text. Requested settings do not certify provider/account identity or exact outbound data.
