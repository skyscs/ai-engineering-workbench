# Connected-path representation audit

Task 095 uses unchanged worker-read services and an independent tiny fixture with
24 fact-free markers. It wraps the public validated fact read to count representation
fields and reuses existing diagnostic count hooks. It records no object references,
source parameters, heap profile or resource score. JSON byte counts describe serialized
representation only; adding these counts can itself allocate and alter timings.

Each default/repeat/selected/page/isolated observation is paired with the ordinary
reader on the same inventory. Complete raw results, stable work/read metrics and
zero Git/catalog writes must agree. The path wrapper's own invocation counter is
excluded explicitly because the ordinary comparison injects a separate path object;
both still execute one actual path read. All full-file original validation remains.

The entry requires a clean committed tree and an owned absolute
`LOREDOCK_REPRESENTATION_OUTPUT`. Load it through the existing local `tsx` loader
from `apps/loredock`, under a 60-second external watchdog/five-second kill grace.
Retain the first report/input/receipts/stdout/stderr/exit, including failures.
Bounds and interpretation are fixed in [Task 095](../../tasks/095-loredock-path-representation.md).
No frozen resource family or measured module is imported or modified.
