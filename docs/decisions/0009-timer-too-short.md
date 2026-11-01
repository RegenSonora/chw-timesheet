# 0009 — Timer stopped too short

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §5 ("Too short"), §10

## Decision

When Stop is tapped and the time rounds to 0 h (under 7.5 minutes), the app shows "That's under 8 minutes, too short to bill." with two choices:

- **Keep timing:** the timer keeps running from its original start.
- **Discard:** the timer is removed and the CHW returns Home.

Nothing is saved either way.

## Why

An early Stop is usually a slip. Discarding automatically would lose the start time, against SPEC §10's rule that interruptions never lose a half-entered record.
