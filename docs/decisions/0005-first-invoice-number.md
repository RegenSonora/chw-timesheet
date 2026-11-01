# 0005 — First invoice number

- **Status:** Accepted by Chris, October 31, 2026
- **Spec:** SPEC §6

## Decision

Setup asks for the next invoice number, defaulting to 1, so a CHW who already sent paper invoices (for example CC-2026-001 to 003) can continue at 004. Once the first invoice is created on the phone the number can no longer be changed. After that the shared counter only moves forward, across years and initials changes, as SPEC §6 says.

## Why

Without it, a CHW with paper invoices would repeat a number the office already has. Locking it after the first invoice keeps numbers from repeating or resetting.
