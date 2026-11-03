# 0029 — Counts per task

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §5 (counts), §6 (counts on invoices), §7 (page 1 and entry log CSV)
- **Plan:** [roles plan](../roles-plan.md), milestones R1–R5

## Decision

1. **One shared count list** at the top of `roles.json`. Each task in a role lists the counts it shows (`count_ids`), and a task can list none.
   - Count ids use underscores (`trailer_loads_removed`) because they become entry log column names. Task and budget line ids use hyphens.
   - Count ids never change and are never reused.
2. **Units:** a count may carry a unit (`"unit": "gal"`, `"sq ft"`). Values are whole numbers.
3. **"Add another count" stays on every role and task.** If a typed label matches one of the entry's counts (ignoring letter case and spaces), the app points the person to that count instead of adding a duplicate: "Trees planted is already a count above. Use that one." The entry can't be saved until the label changes.
4. **Split entries:** the person sees the combined counts of every checked task, entered once. The entry log puts them on part 1 (decision 0024).
5. **Invoice and timesheet page:** lists only counts with a value in the period, each with its all-time total beside it, for example "Trees planted 6 41". At most 10 rows; the rest are in the entry log CSV.
6. **Entry log CSV:** one column for every count in the roles file, in list order. New counts go at the end of the list.
   - A count taken out of every task is marked `"retired": true`, not deleted, and keeps its column.
   - "Add another count" values stay in the single `other_counts` column, joined with "; ".
7. **Stored data:** counts are kept by count id (`{ values: { [id]: n }, other: [...] }`, data v4). The upgrade from v3 moves the five fixed CHW counts into `values` under the same ids.

## Decided during the build

- **A count stays visible once it has a value.** The entry shows the checked tasks' counts plus any count that already holds a value, so unchecking a task or an office edit never hides a number.
- **Entry log count cells are blank unless above 0** (Chris, November 3). Past invoices shared again get the new columns and blanks in place of 0s, so files from every release stack.

## Why

Each kind of work has its own measures. Listing counts per task keeps the counts step short and the totals meaningful, while one shared list keeps the entry log's columns stable across roles.
