# 0013 — Timesheet page that doesn't fit

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §7 ("PDF timesheet pages")

## Decision

Each PDF timesheet page always holds the next 7 dates worked on one landscape sheet, so the PDF pages and the timesheet CSV blocks stay the same. When the rows don't fit, the grid's text shrinks, down to 7 pt. Notes that still don't fit are cut short with "…". The full notes are always in both CSV files. If the rows alone still don't fit at 7 pt, the text keeps shrinking; hours are never cut.

## Why

The spec fixes 7 dates per page but not what happens when many rows with long notes don't fit. Continuing on extra sheets would break the "Page X of N" match between the PDF and the timesheet CSV.
