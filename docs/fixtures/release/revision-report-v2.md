# Investigation report — version 2

- Title at run time: Release revision investigation
- Task ID: 881a73b9\-c22b\-4da7\-86fb\-799967bcdc1b
- Report ID: 61ae2ed9\-299d\-44da\-98a2\-cd156b4325c2
- Root cause ID: 677108de\-afb0\-4693\-8ef7\-cb6430f0d90f
- Stage run ID: 947df582\-6033\-4e57\-bd3c\-49ca947d57ed
- Published: 2026\-09\-11T10:42:03\.762Z
- Exported: 2026\-09\-11T10:42:03\.945Z
- Lifecycle at export: active
- Freshness at export: fresh
- Context revision: 4
- Previous report ID: e44bd2c7\-c088\-4dbf\-8779\-c5d8d4c3a20c
- Triggering intervention ID: 237b696b\-e0f9\-4285\-867f\-09355fb1ee81

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


> Preserve tenant isolation\. Compare the tenant\-scoped cache history and incident observations before accepting the display\-refactor hypothesis\. Do not implement changes\.


## Triggering challenge

> The initial report lacked the affected request sequence\. I added the incident log: beta receives alpha's title for the same SKU, with uppercase disabled and a correct database value\. Reassess the incident cause against the exact earlier report and explain which uncertainty is now resolved\.


## Selected repository pins

- 0bde177c-7c55-40a7-b82b-5762a9495a1e: bbcc3e80f4fce31f9de1c27a09f737a090c369da

## Selected artifact ranges

- Artifact ID: 7d0ababc\-3cbe\-46c4\-88eb\-4c591aa4298d
- SHA-256: 14bf5c0500ba9f448cb5406636d8f679e866289590d9fb86f00a3a1699981286
- UTF-8 byte range: \[0, 383\)

## Investigation

> The added incident log resolves the earlier uncertainty about whether the known tenant\-isolation defect occurred in the reported incident\. After a restart, alpha/42 loaded and returned “Alpha kettle”; beta/42 then had a cache hit and returned that same alpha title despite beta’s database title being “Beta lamp\.” The pinned cache keys entries by SKU alone, so both requests use key \`42\`\. This is a demonstrated causal match\. The display refactor is not the cause: uppercase was false for both requests, and that refactor only supplies a default for that display argument\.

## Historical timeline


> The original cache implementation used a tenant\-and\-SKU composite key, separating entries for tenants that share a SKU\.

- Evidence IDs: e1

> Commit 1c870bc changed the cache key from \`$\{tenant\}:$\{sku\}\` to \`sku\` while retaining the process\-wide Map and loader behavior\.

- Evidence IDs: e2

> At the pinned revision, the cache still stores and retrieves titles using SKU alone, contrary to the documented requirement that titles never cross tenants\.

- Evidence IDs: e3, e4

> The supplied incident sequence shows, after restart, alpha/42 returning “Alpha kettle,” followed by beta/42 receiving “Alpha kettle” on a cache hit although beta/42 directly resolves to “Beta lamp\.”

- Evidence IDs: e5

> The later display refactor only defaults an omitted uppercase argument to false; the supplied requests explicitly used uppercase=false, so it cannot explain the cross\-tenant title selection\.

- Evidence IDs: e6, e7, e5

## Root cause

- Conclusion: identified

> The incident was caused by the tenant\-unsafe cache key introduced in 1c870bc38de9e1a458a2111a164bc50d06860de4\. Because the process\-wide Map is keyed only by SKU, alpha’s request for SKU 42 populated key \`42\` with “Alpha kettle\.” Beta’s subsequent request for the same SKU hit that entry and returned alpha’s title instead of invoking its loader for “Beta lamp\.” The incident log directly observes this sequence and rules out the display\-flag hypothesis for these requests\.

- Evidence IDs: e2, e3, e5

## Unresolved questions

None reported.

## Evidence locators

### e1


> The pre\-refactor implementation keys cached titles with both tenant and SKU\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: 9e14bda54fbf486dc297d2e54cce4ff7c0c572bc
- Repository-relative path: cache\.mjs
- Line start: 1
- Line end: 6
- Source at export: Available; locator rechecked

### e2


> This commit changes the cache key from a tenant\-and\-SKU composite to SKU alone\.

- Kind: git\_commit
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: 1c870bc38de9e1a458a2111a164bc50d06860de4
- Source at export: Available; locator rechecked

### e3


> The pinned cache uses SKU alone as the Map key and returns an existing entry without calling the loader\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Repository-relative path: cache\.mjs
- Line start: 1
- Line end: 6
- Source at export: Available; locator rechecked

### e4


> The repository states that tenants may have different titles for the same SKU and cached titles must not cross tenants\.

- Kind: repository\_file
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Repository-relative path: README\.md
- Line start: 1
- Line end: 1
- Source at export: Available; locator rechecked

### e5


> The incident log records the restart, alpha then beta requests for SKU 42, beta’s cache hit and returned alpha title, and beta’s correct direct database result\.

- Kind: artifact
- Artifact ID: 7d0ababc\-3cbe\-46c4\-88eb\-4c591aa4298d
- SHA-256: 14bf5c0500ba9f448cb5406636d8f679e866289590d9fb86f00a3a1699981286
- Byte start (inclusive): 0
- Byte end (exclusive): 383
- Source at export: Available; locator rechecked

### e6


> This display refactor only changes the uppercase parameter to default to false\.

- Kind: git\_commit
- Repository ID: 0bde177c\-7c55\-40a7\-b82b\-5762a9495a1e
- Commit SHA: bbcc3e80f4fce31f9de1c27a09f737a090c369da
- Source at export: Available; locator rechecked

### e7


> The pinned display function only uppercases an already supplied value when uppercase is true\.

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
