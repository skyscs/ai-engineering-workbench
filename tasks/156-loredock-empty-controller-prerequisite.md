# Task 156 — Correct empty controller evidence before direct birth

Status: planned after Task 155 retained-result acceptance. Its sole attempt stops before
native execution because the helper expects a newline instead of a zero-byte empty
controller list. This is an adapter defect, not an observed clone3 capability failure.

1. Preserve every consumed Task 155 input, helper, claim, failed-unit state and first
   record. Use the retained raw target observation and versioned kernel formatter source
   to define exact empty/nonempty controller-list handling without inventing whitespace.
2. Build a separate adapter on the unchanged environment. Reuse the pinned native,
   capture, protocol, ownership and payload implementations where appropriate; alter only
   new-candidate admission and controller parsing. Keep raw observations unchanged.
3. Add an end-to-end mocked leaf-creation regression using the actual retained zero-byte
   inputs. Cover malformed/duplicate/unknown controller text, enabled target controllers,
   changed identities, errors between mkdir/open and descriptor cleanup. Exercise the
   complete service admission path so a valid empty leaf actually reaches native capture.
4. Keep Task 155's exact tiny work, namespace/security/retention and 10/5/2-second profile,
   four-second native deadline, five-second capture and 25-second launcher bounds. No
   additional controller, pressure, privilege, host-profile, runtime or application change.
5. Review full local checks and commit/seal one fresh candidate. Run at most one fresh
   service/clone3/sandbox/payload attempt. Preserve failure and never rerun a consumed first
   entry. An actual capability failure ends this path without environment tuning.
6. Retain Task 155 accepted CI and the complete new first evidence. Review both complete
   exact-head CI logs before merge. Even a pass proves only direct birth and its fixed
   namespace prerequisite; counter lifetime, interrupted-collector/orphan behavior,
   application resources/timing, semantic quality and the bridge remain separate.
