# 0024 — Several tasks per entry, with the hours split between them

- **Status:** Accepted, November 2, 2026
- **Spec:** SPEC §5 (entry flow, editing), §7 (timesheet rows, entry log, fingerprint), §9 (screens); changes decision 0001 (entry log layout) for this app

## Decision

CHWs often do more than one task in one block of time. An entry can now have several tasks, and its hours are split between them.

1. **Tasks are check boxes.** "What did you do?" lets the CHW check every task they did in the entry.
2. **The split is per entry, in quarter hours.** The total to match is the entry's billed hours (rounded to 0.25 h, SPEC §5). Each checked task gets a share in 0.25 h steps. The shares must add up to the entry's billed hours exactly.
3. **"Split your time" step.** With two or more tasks checked, a new step after "What did you do?" shows each checked task with − and + buttons and a bar: "1.50 h logged · 0.50 h left", "0.25 h too many" or "All 1.50 h assigned". Next is blocked until nothing is left. The first checked task starts with all the hours. With one task checked the step is skipped and that task gets all the hours, so a typical entry is still 4 taps. A task left at 0 h is dropped on save.
4. **One entry, task shares.** An entry keeps its raw start and stop, counts and notes once, and stores `tasks: [{ task_id, quarters }]` in place of `task_id`. Overlap, rounding, entry dates, locking and invoice lines are unchanged.
5. **Editing.** If an entry's billed hours change, a one-task entry follows the new total. A split entry must be split again before Save changes.
6. **Timesheet.** Each share adds its hours to its task's row. An entry's notes join on every row it adds to (decision 0003).
7. **Entry log CSV: one row per task share.** A new `part` column ("1 of 2") follows `entry_id`. `billed_hours` is that row's hours, so the column still adds up to the invoice hours. Raw start, stop and `raw_duration` are the whole entry's. Counts and notes are on part 1 only, so they add up without counting twice. A one-task entry is one row, "1 of 1".
8. **Fingerprint canonical form v2** lists each entry's task shares. Invoices made before this change keep canonical form v1 and still verify.
9. **Stored data version 3.** The upgrade turns every entry's `task_id` into one share holding all its hours, and does the same for entries frozen in past invoices.

## Why

A radio button forced one task per block, so CHWs either split their time by hand into made-up entries or under-reported tasks. Keeping one entry with shares keeps the raw times true. Storing one entry per task would need invented start and stop times and would duplicate counts and notes. Quarter-hour shares match billing, so task hours always add up exactly. One row per share in the entry log lets a spreadsheet total hours by task. Making `billed_hours` the row's own hours avoids two different hours numbers on one row.

## Known limit

A 15-minute entry can have only one task, and a 30-minute entry at most two.
