# 0008 — Changing an entry's funding source

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §5

## Decision

While an entry is not yet invoiced, Edit entry shows its funding source with **Change**, like the new-entry task screen. Raw start and stop times are kept exactly. The task and budget line carry over when the new source has the same ones (matched by id); otherwise the CHW picks again before saving. After saving, Home shows "Moved to <CODE>" with Undo.

## Why

Logging under the wrong source is an easy mistake. Deleting and logging again would retype times and lose a timer's exact start and stop.
