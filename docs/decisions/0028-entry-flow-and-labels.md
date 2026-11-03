# 0028 — Entry flow and labels

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §5 (entry flow), §7 (budget line names on files)
- **Plan:** [roles plan](../roles-plan.md), milestone R4

## Decision

1. **The flow:** funding source → budget line → tasks for that line (check boxes) → split your time (when two or more tasks are checked, decision 0024) → counts for the checked tasks, plus notes.
2. **A step with one option is picked automatically and shown as a plain label**, never a greyed-out control. For example, at the top of the task step: "Billed to: **TISUPP · CHW experience hours**". The same label shows in place of the Home source chip when there is one source. This replaces the hidden rows of Gila's 0023.
3. **Budget line display names.** A budget line may carry a `display_name` shown in the app, while its `name` prints on invoices, timesheets and CSVs. Example: the app shows "Other"; the files show "Other contractors". Without a `display_name`, `name` is used everywhere.
4. **No time splits across sources.** Each entry is billed to one source.

## Decided during the build

- **The task list waits for a budget line.** With several lines it says "Pick a budget line to see its tasks." Changing the line drops checked tasks that aren't on the new line.
- **The counter keeps the label "Next invoice number"** in Setup and Settings for every role, employees included, because their timesheets share the counter (Chris, November 3). The hint under it says "timesheet" for employees.

## Why

Most people bill one source and one line, so most entries need only the task step. Showing the pick as a label keeps it visible without making it a control that does nothing.
