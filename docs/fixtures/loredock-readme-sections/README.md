# README section navigation verification

Task 058, 2026-11-01. Scope `078c48d`; implementation `a59da3a`; final layout
`7e66e29`. All inputs are owned synthetic repositories. No corporate code or models.

`pnpm check` passed strict typecheck, 434 tests and production builds on Node 22.23.2.
The 23-test focused orientation/section run passed nesting, matching fence closers,
HTML/comment/list/quote exclusions, literal inline markup, duplicate headings, UTF-8
and count omissions, multi-span references, corrupt evidence, read-only/Git-free
projection, historical refresh/restart and policy/source boundaries. The new integration
check found a terminal-newline range mismatch; the selector now matches issued evidence
line numbering. Existing introductory prose and document budgets are unchanged.

The compiled Chrome check passed nine recorded browser conditions in [result.json](result.json):

- Verified isolated transport before application navigation; only the owned in-process
  app receives browser requests at the normal application origin.
- Collapsed navigation, twelve visible headings, six explicit omissions and inert hostile
  markup; apparent headings in a fenced code block are absent.
- All three original parts for Architecture open and focus the evidence viewer.
- Desktop and 390px layout, including a 160-byte unbroken heading.
- Updated headings and immutable historical section navigation.
- Delayed orientation responses after index selection and source removal, and delayed
  section evidence after a policy change, cannot repopulate the old view.
- Source heads and working trees remain unchanged after the fixture's explicit update.

The first browser rehearsal incorrectly saved the unchanged policy and therefore observed
no policy-version fence. The harness now changes the owned policy before asserting it.
A subsequent successful run exposed cramped part links on visual review; the final layout
adds spacing/wrapping and repeats the complete browser scenario. Screenshots were visually
reviewed: [desktop](sections-desktop.png), [390px](sections-mobile.png).

## Reproduction and limits

Use Node >=22.13, pnpm 10.15.0 and Google Chrome on Linux. After `pnpm install
--frozen-lockfile` and `pnpm build`, run:

```sh
LOREDOCK_SMOKE_OUTPUT=/absolute/result-directory node scripts/loredock-readme-sections-smoke.mjs
```

If another instance serves this checkout's compiled assets, build/run from a separate
owned checkout as done for this verification. The smoke binds only an ephemeral proxy,
never port 4244. It rejects other origins and CONNECT requests, has no network forwarding,
and dispatches to the compiled application's normal Host/Origin/session/CSRF/CSP handlers.
A fresh Chrome profile uses an explicit loopback proxy override and a unique ownership
sentinel before navigation. It cleans up its process group, proxy, data and repositories.
The result directory remains available. Answer and code-analysis services are not enabled
in this focused navigation check. No test request reaches the running user demo.

The browser scenario covers three repositories, not large-project latency or semantic
architecture quality. Heading selection is a conservative partial ATX profile, not a full
Markdown parser; unsupported heading styles can be absent without an omission count.
Read the complete original for context. Historical evaluations remain frozen; their failed
semantic gates and the pending private pilot are unaffected.
