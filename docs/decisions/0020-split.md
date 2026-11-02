# 0020 — Split into Regen Time Tracking and CHW Time Tracker Historic

- **Status:** Accepted by Chris, November 2, 2026
- **Spec:** SPEC §1, §2 (hosting, repo, storage)

## Decision

The app becomes two apps. No CHWs used it yet, so no phone data is affected.

| | Regen Time Tracking | CHW Time Tracker Historic |
|---|---|---|
| Repo | `RegenSonora/regen-time-tracking` (the original repo, renamed from `chw-timesheet`) | `RegenSonora/chw-time-tracker-historic`, archived |
| Address | https://regensonora.github.io/regen-time-tracking/ | https://regensonora.github.io/chw-time-tracker-historic/ |
| State | Active: own funding sources and features from here on | Frozen at the split point (tag `historic-0.9.0`, commit `2d65429`), released as 0.9.1 with only its new name and storage |
| Phone database | `regen-time-tracking` | `chw-historic` |
| Offline cache names | `regen-<version>` | `chw-historic-<version>` |
| Icon | Desert night scene (decision 0021) | Caduceus in an egg (decision 0017) |

## Why

Both apps live on the same web origin, `regensonora.github.io`, where phone storage and offline caches are shared by every RegenSonora site. Separate database names and cache prefixes keep the two apps from reading each other's entries or deleting each other's offline files. A repo publishes one Pages site, so each app has its own repo. Renaming the original repo keeps its pull requests, issues and settings with the app that is still being built; the frozen snapshot only needs its commits.

## A third app

**CHW Gila River Contractors** was copied from the same split point afterwards, at https://regensonora.github.io/chw-gila-river-contractors/ (repo `RegenSonora/chw-gila-river-contractors`, database `chw-gila-river-contractors`, cache prefix `gila-`, river valley icon). Its decision 0022 lives in that repo.

## Fixes later

A fix that applies to both is ported with `git cherry-pick -x` from the other repo added as a second remote. Historic must be unarchived first, and archived again after.
