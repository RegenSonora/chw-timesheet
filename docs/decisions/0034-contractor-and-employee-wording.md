# 0034 — "Contractor" and "Employee" wording

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §4, §7, §9
- **Plan:** [roles plan](../roles-plan.md), milestones R4, R5, R8

## Decision

Where 0.10.0 says "CHW", files and screens use the role's type:

| Where | Contractor | Employee |
|---|---|---|
| Invoice or timesheet caption (was "Contractor (CHW)") | Contractor | Employee |
| Timesheet initials label (was "CHW initials") | Contractor initials | Employee initials |
| Timesheet CSV header row (was "CHW") | Contractor | Employee |
| Setup, Settings and README copy | Neutral ("you", "your name") | Neutral |

Phones with no role (decision 0027) print the contractor wording.

## Why

Not every role is a CHW role, and employees are not contractors. Naming the person's type keeps the files accurate for everyone.
