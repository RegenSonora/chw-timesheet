# 0011 — QR code payload

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §7 ("Fingerprint and QR code")

## Decision

The QR code on PDF page 1 holds compact JSON, version 1, with integers like the stored data:

```
{"v":1,"n":"CC-2026-004","p":["2026-10-20","2026-10-30"],"l":[["new-chws",12,6000],["chw-referrals",13,6500],["outreach-and-marketing",12,6000]],"f":"<64 hex characters>"}
```

- `v`: payload version. `n`: invoice #. `p`: service period, first and last entry date.
- `l`: one `[budget line id, quarter-hours, amount in cents]` per invoice line, in the invoice's line order.
- `f`: the full fingerprint.

Keys appear in this order, with no spaces. Like the fingerprint's canonical form (CLAUDE.md rule 8), the payload never changes without a new `v`, and a golden test pins v1.

## Why

The spec lists what the QR holds but not how. Ids, quarter-hours and cents are what the data files use, so a later system can match paper to data without parsing names or decimals, and the code stays small enough to scan from a printed or scanned page.
