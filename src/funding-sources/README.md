# src/funding-sources

One JSON file per funding source (CLAUDE.md rule 6), validated against `schemas/funding-source.schema.json` at build time. Roles in `src/roles/roles.json` pick which of a source's budget lines and tasks each person sees (decision 0027).

Task lists and certification text here are licensed CC BY 4.0 (see `NOTICE`).

Files: `tisupp.json` (code `TISUPP`) and `regen-general-operating.json` (code `REGEN-GO`, decision 0006). A file is named `<id>.json`; ids never change once released. Bump `version` when tasks, budget lines or text change.

- **Grant period:** `period_start` and `period_end`, each a date or `null` for open (decision 0033). TISUPP runs October 1, 2026 to September 30, 2027; Regen General Operating is open at both ends.
- **Certification:** `certification_text` for contractors' invoices; `employee_certification_text` for employees' timesheets (decision 0031). A role may override either.
- **Budget line `display_name`:** shown in the app when set; `name` prints on invoices, timesheets and CSVs (decision 0028). Regen General Operating shows "Other contractors" as "Other".
- **Still on the source until their readers move to roles:** TISUPP's `rate_step` (240 hours) and `certification_step` (480 hours), and the optional `default_nte_cents`. Roles carry the same values (roles plan R2, R4, R6).
