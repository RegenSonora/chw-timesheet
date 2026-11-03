# 0023 — A choice with one option is picked for you (single-choice part only)

- **Status:** Accepted, November 2, 2026. Ported from chw-gila-river-contractors, November 3, 2026 (roles plan P1); Regen changes accepted by Chris.
- **Spec:** SPEC §5 (entry flow)
- **Ported from chw-gila-river-contractors:** Gila's record 0023, "Gila River contractors: TISUPP only, one budget line, a reminder at 240 hours". Only its single-choice rule comes over. Regen keeps Gila's number.

## Decision

1. **A choice with one option is not asked.** It is picked for the CHW. This covers the entry flow's source and budget line rows and the Home source chip. Entries still store a source and a budget line, so storage, invoices, files and the fingerprint are unchanged. A row shows again if a draft ever holds a pick that doesn't match.
2. **In Regen the pick is shown, never hidden** (decision 0028): "Billed to: TISUPP", or "Billed to: TISUPP · CHW experience hours" when both the source and the line have one choice.

## Not ported

- **TISUPP only.** Regen keeps both sources, TISUPP and Regen General Operating, with all their budget lines.
- **One budget line.** Regen's TISUPP keeps its 12 lines and adds CHW experience hours (`chw-experience-hours`) alongside them.
- **NTE prefill.** The optional `default_nte_cents` field is in the schema, but no Regen source sets it. The CHW enters the NTE in Settings, as before. Roles carry the NTE later (decision 0030).
- **The source-level raise step.** Roles carry it later (decision 0030). Until roles land (R1, R2), Regen's TISUPP carries Gila's `rate_step` (240 hours, $23.00) and the reminder on Home, so the ported My stats card (decision 0026) works. Chris chose this for P1 on November 3, 2026.

## Why

Asking a question with one answer adds taps and chances for mistakes. Showing the answer as a label, instead of hiding it, keeps the CHW sure where the hours are billed.
