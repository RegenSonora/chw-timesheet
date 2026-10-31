# 0003 — Joining notes on a timesheet row

- **Status:** Accepted by Chris, October 31, 2026
- **Spec:** SPEC §7

## Decision

When several entries fall in one timesheet row (same task and budget line on the same page), their notes are joined with "; " in order of entry start time, oldest first. Empty notes are skipped. A note that exactly repeats an earlier note in the same row is shown once. Notes are compared after trimming spaces at the start and end.

## Why

The spec said notes are joined but not how. CHWs often repeat a note such as "Library table" across visits; repeating it on the timesheet adds length without information.
