# ADR 0051 — Qualify event candidates from direct topic literals

## Status

Design decision recorded by Task 072, 2026-11-03. Production behavior remains unchanged;
Task 071's first qualification is rejected and exhausted.

## Decision

Use a new offline candidate rule that compares supported direct Java topic literals at
both publisher/subscriber call sites, retaining existing contract, complete consumer-domain,
original-support and bounded-work requirements. Do not infer a configuration field's role
from the special `orderTopic` name, a suffix, or a coincidentally equal value.

A matching literal pair is a static connection candidate. Broker, delivery, serialization,
dispatch and deployment remain unknown. Dynamic/escaped/computed expressions abstain in
the first narrow profile, even when settings match. Keep the existing production/legacy
adapters and history untouched until fresh qualification and a separate integration review.
See the [full topic-evidence contract](../loredock/EVENT_TOPIC_EVIDENCE.md).

## Why

Task 071's new `bookingTopic` fixture exposes a business-specific condition in the current
resolver. Renaming that frozen fixture or broadly accepting arbitrary settings would hide
the limitation. Direct literal evidence gives a small, explainable source-based predicate
without inventing configuration-to-code binding.

Task 071 also selected a handler-reference node by label while intending its Java symbol.
The successor must use typed source/path identities and retain raw observations before
assertions; a harness error cannot qualify production behavior.

## Consequences

The next task freezes fresh structural, negative, ambiguity, support, resource and receipt-
lifecycle cases before implementing the separate candidate. Version topic provenance and
all affected identities explicitly. Compare losses for dynamic calls instead of silently
falling back to the old profile. No legacy notes, answer inputs or saved receipts migrate
by label or ID. Broader syntax/configuration binding and semantic/private-pilot acceptance
remain separately scoped.
