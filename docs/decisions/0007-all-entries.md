# 0007 — The "All entries" list

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §5, §9

## Decision

"Show all N entries" on Home opens every **not yet invoiced** entry for the funding source on the header chip, newest first, grouped by date. Entries for other sources are not shown; switch the chip to see them. Invoiced entries are not shown anywhere in the app: the CHW's sent email with the invoice files is the record of past work.

## Why

The list matches Home's count and the invoice the Generate button would create, and keeps the rule that the chip decides what the CHW is looking at. Showing every source would make the count differ from Home and put rows from two invoices in one list. A toggle for all sources can be added after the pilot if CHWs ask for it.

## Re-sharing past invoices (decided for M4)

Chris said there is no need for past invoice access, as long as the files were actually shared. On November 1, 2026 he decided to **keep** re-sharing a past invoice as SPEC §6 says ("re-create and re-share any past invoice"). Re-sharing is the only way to reach an invoiced entry in the app; where the CHW finds past invoices is decision 0012. The share step also checks that the files were shared: tapping Done before a successful share asks first.
