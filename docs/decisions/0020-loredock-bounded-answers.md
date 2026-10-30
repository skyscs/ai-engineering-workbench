# ADR 0020 — Bounded LoreDock answers and a separate text runtime

Date: 2026-09-30. Status: implemented for opt-in evaluation; human acceptance pending.

## Decision

Keep the Workbench investigation adapter and its qualified versions unchanged. Add
an independent `TextRuntime` contract in `packages/ai`, with no Workbench task/storage
dependency. LoreDock owns retrieval, attempt state and publication. The selected
Linux pilot is Codex CLI 0.159.2, `gpt-5.6-terra`, medium reasoning. Execution stays
behind `LOREDOCK_ANSWERS=1` while the Task 016 acceptance gate is open.

### Runtime boundary

The CLI receives bounded text through stdin in an owned empty temporary directory.
It receives no source checkout path. Disable shell, browsing, apps, plugins, hooks,
images, MCP, delegation and other executable capabilities. `agents.enabled=false`
is required in addition to the multi-agent feature flags. Actual synthetic tool calls
show only `apply_patch` in Code Mode; read-only permissions reject it. Code Mode has
no process, require, fetch or shell entry point. No subagent was launched by the probe.

This is a **capability boundary**, not the narrow filesystem namespace exercised by
the separate sandbox-helper experiment. Production `exec --sandbox read-only` can
give trusted CLI internals broad reads. The helper's denied outside/symlink/child reads
must not be represented as proof that production CLI internals cannot read those paths.
Provider transport remains available to the trusted CLI; source-directed network tools
are unavailable to the model. A compromised CLI/host is outside this boundary.

Use `--no-daemon`, ephemeral execution, an allowlisted environment and disabled project
document discovery. Reject ancestor `.codex` entries and global `AGENTS.md` or
`AGENTS.override.md` in the selected configuration directory. The probe demonstrated
that global instructions otherwise survive a zero project-document budget. Suppress
host skill discovery and use a one-token skill catalog budget; the synthetic skill
canary is absent from the model request. The pinned CLI reports this successful
suppression as an error item. Only that exact diagnostic is nonfatal; real error and
failed-turn events still reject publication.

Preflight checks the exact CLI version, disabled feature state, disabled MCP servers
and canonical saved connection. Fingerprint launcher/config-file metadata before and
after preflight and before dispatch. This is configuration change detection, not a
content hash of every native/transitive configuration dependency or proof of account
identity. The diagnostic report separately hashes the launcher and native helper.
Installation and selected configuration must remain trusted and stable during a run.
Never parse/copy authentication or session stores; the CLI uses the explicitly chosen
configuration. Reject ambient provider overrides instead of changing accounts silently.

One application dispatch is allowed per prepared runtime, with a 120-second overall
attempt limit and 256 KiB captured output. The application never retries an invocation.
This does not promise provider-side cancellation, zero billing after interruption, or
exactly one HTTP request inside the CLI's transport. Record reported usage, otherwise
an explicit unknown. No dollar estimate is inferred from tokens.

### Retrieval and durable publication

Schema 2 adds a separate Porter-tokenized FTS index for natural-language questions.
Normalize camelCase, acronym boundaries and separators without changing original
evidence bytes. Expand once using up to 12 literal identifiers from the strongest six
matches, and include at most three matched repositories' root README spans. This is
bounded lexical expansion, not a call graph or semantic search. Existing literal
source search retains its original behavior. Migrate prior spans transactionally;
purge both indexes on source revocation.

Keep the 120-candidate, 30-span and 64 KiB source-text limits. The complete prompt has
a separate 96 KiB cap. Record omitted evidence and unknown deployment coherence.
Question strings enter retrieval; the frozen oracle is available only to evaluation.

Schema 3 adds selected connection settings, immutable answer attempts and source
dependency rows. Persist intention, question, build/policy/registry versions, issued
context/hash, model/effort and prompt/schema versions before preflight; persist runtime
identity before dispatch. Bind request replay to the same inputs and connection.
Publish validated result and success together inside a transaction, after checking live
authorization and every issued span, including uncited inputs. Usage receipts survive
validation failure and late cancelled completion; they do not authorize publication.

Cancellation, registry/policy change and source revocation abort active work and win
over late completion. Failed/cancelled work retains the prior authorized answer.
Restart marks unfinished attempts interrupted and never redispatches automatically.
Revocation fences and logically purges dependent contexts/results; policy changes fence
historical reads. All context sources are dependencies, including orientation metadata.
Saved answers identify their index and show when a newer index or registry is available.

## Consequences and acceptance

The browser offers one saved setup, a question, a model-free context preview and explicit
generation. It renders plain escaped text and reopens citations through authorized
evidence routes. No executable result fields, Markdown HTML or client-supplied context
objects are accepted. Configuration, preview, attempts and cancellation reuse the local
Host/Origin/session/CSRF boundary.

Mechanical citation validation does not establish semantic grounding. Keep the first
failed evaluation, distinguish retrieval misses from answer errors, and review all
claims/unknowns against source text. Agent review is not the human review required by
the roadmap. Relationships, routing, embeddings and the Workbench bridge remain later
tasks. See [acceptance evidence](../fixtures/loredock-answers/README.md).
