# 0010 — Adding a funding source after setup

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §4

## Decision

Settings lists funding sources the CHW has not added yet, each with **Add**, which asks for the hourly rate (prefilled from the source file's default when it has one). Once added, a source stays; there is no remove.

## Why

A CHW may get a second agreement after setup. Re-running setup would erase uninvoiced entries. Removing a source raises questions about its entries and all-time counts for little gain.
