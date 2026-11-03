# 0033 — Grant periods

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §3 (source files), §5 (entry flow, Home)
- **Plan:** [roles plan](../roles-plan.md), milestones R1, R2, R4

## Decision

1. **Each source file gets `period_start` and `period_end`.** A role's funding entry may set its own earlier `ends`.
2. **A source isn't offered for time dated outside its period.** Hours dated inside the period can still be logged and invoiced or submitted after it ends.
3. **If every source on a role has ended**, Home says: "No active funding for your role. Ask the office."
4. **TISUPP:** October 1, 2026 to September 30, 2027. **Regen General Operating:** no end date.

## Decided during the build

- **When every source has ended, Record time stays** for dates inside a period; Start timer is hidden (Chris, November 3).
- **Enter times checks the date.** With no source of the role taking time on that date it says "None of your funding takes time on this date. Ask the office." and Next stays off. If the entry's source doesn't cover the date but another does, the source row asks for another pick.

## Why

Grants pay only for work inside their dates. Checking the date when time is logged catches a wrong date before it reaches an invoice, while still letting late paperwork for earlier dates go through.
