# 0001 — CSV layouts

- **Status:** Accepted by Chris, October 31, 2026
- **Spec:** SPEC §7

## Decision

The two CSV files serve different readers:

- **Timesheet CSV** is for people. It mirrors the PDF timesheet pages: a header block (invoice #, funding source, CHW, service period, rate, fingerprint), then one block per page with its own header row of dates worked, task rows and a total hours row. No dollar amounts.
- **Entry log CSV** is for spreadsheets and later systems. One header row and one row per entry, with fixed columns (listed in SPEC §7) so files from different invoices combine cleanly. No per-entry dollar amount.

## Why

The timesheet CSV was asked to look like the existing paper timesheet without the invoice parts. A per-page grid can't also be one clean table, so the machine-readable need moves to the entry log, which already holds every raw detail. Per-entry amounts are left out because amounts are rounded once per budget line and would not sum exactly to the invoice total.
