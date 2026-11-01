# 0012 — Where past invoices are

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §6, §9; decision 0007

## Decision

Settings has a **Past invoices** row. It opens a list of every invoice on the phone, newest first, each showing its number, funding source code, service period and total. Tapping one opens that invoice's share screen, which re-creates the three files from stored data and shares them again.

## Why

Re-sharing is rare (a lost email, a reviewer asking again), so it stays off Home, which is for logging. Decision 0007 makes re-share the only way to reach invoiced work.
