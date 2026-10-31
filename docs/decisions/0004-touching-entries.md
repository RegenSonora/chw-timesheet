# 0004 — Back-to-back entries

- **Status:** Accepted by Chris, October 31, 2026
- **Spec:** SPEC §5

## Decision

An entry may start at the exact second another entry ends. Overlap is checked on raw start and stop times as half-open ranges: entry A overlaps entry B only when A starts before B stops and B starts before A stops. This holds across all funding sources.

## Why

Back-to-back tasks are common in the field (stop one timer, start the next). Only real overlap is double billing.
