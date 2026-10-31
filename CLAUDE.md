# CLAUDE.md — CHW Time Tracker

Read this file at the start of every session. It holds the rules that do not change from task to task.

## What this project is

A lightweight, offline phone app for Community Health Workers (CHWs) at Regenerating Sonora, Inc. CHWs log time against a funding source, then generate an invoice PDF plus two CSV files to sign and email. Chris (Executive Director) approves product decisions.

Separate product from the grant compliance platform (`RegenSonora/granthandler`). Share no code with it. Keep file formats readable by it later (UUIDs, ISO dates, integer cents).

## Where the requirements live

| Source | Use it for |
|---|---|
| `docs/SPEC.md` | **The decided product behavior.** Cite it by section, e.g. `SPEC §6`. |
| `docs/decisions/` | Decisions made during the build. They win over the spec only when they say so and Chris accepted them. |
| `docs/source/CHW_Timesheet_and_Invoice_TISUPP.xlsx` | The paper-era form the app replaces. Reference only. Kept on Chris's computer, never committed (`.gitignore`); everything the build needs from it is in the spec. |
| Wireframes | https://claude.ai/artifact/92kpyaebTLS2Ht4Le6jDmP. Screens match them unless the spec says otherwise. |

## Architecture rules (do not break)

1. **Near-single-file app.** TypeScript + Preact, built by Vite into one self-contained `dist/index.html` (everything inlined), plus `sw.js` (offline cache), `manifest.webmanifest` and icons. Nothing else ships.
2. **No network after load.** No analytics, no runtime CDN, no API calls. A Content-Security-Policy meta tag blocks outgoing connections.
3. **Data stays on the phone.** IndexedDB through `src/storage/`, with an in-memory adapter for tests. Request persistent storage. No backup, no sync.
4. **Pure rules core.** All money, time, rounding, overlap, page-splitting, invoice, counter and fingerprint logic lives in `src/core/` as plain functions with no DOM or storage imports. Screens only display and collect.
5. **Invoiced means frozen.** An invoice and its entries are never edited after creation. Generating an invoice (lock entries, save invoice, advance the counter) is one IndexedDB transaction.
6. **Funding sources are data.** One JSON file per source in `src/funding-sources/`, validated against `schemas/funding-source.schema.json` at build time. Never hard-code a task, budget line, rate or certification text in code.
7. **Stored data is versioned.** Every stored record set carries a format version. Each release ships tested step-by-step upgrades from every earlier version. A failed upgrade leaves data untouched.
8. **The fingerprint's canonical form is versioned.** Never change it without a new version number and a test that old invoices still verify.

## Data conventions

- Money: integer cents. Hours: integer quarter-hours. No floats for either.
- Line amount = quarter-hours × rate cents ÷ 4, rounded half up to the cent; invoice total = sum of lines.
- Entries round to the nearest quarter hour from raw seconds; raw start and stop are always kept.
- Timestamps: ISO 8601 with offset. Display in the phone's time zone (Arizona: no daylight saving). An entry's date is its start date.
- Every record has a UUID (`crypto.randomUUID()`), `created_at` and `updated_at`.
- CSV: UTF-8 with BOM, RFC 4180, ISO dates, formula-injection guard (`=`, `+`, `-`, `@` get a leading apostrophe).

## Dependencies

Runtime: Preact and one small QR library, nothing else without asking. PDF writing and CSV writing are hand-written. Pin versions; licenses must be Apache-2.0 compatible; regenerate `THIRD_PARTY_LICENSES.md` when a runtime dependency changes. Bundle size budget: 150 KB compressed, checked in CI.

## Definition of done

- Rule tests pass (`src/core/`), including every money and time edge case named in the spec.
- Storage tests pass, including upgrades from every earlier data version and an interrupted invoice transaction.
- Generated PDFs open in a PDF reader library with selectable text; CSVs parse; QR codes decode.
- Playwright e2e passes in WebKit and Chromium at phone size, with axe WCAG 2.1 AA checks.
- The real-phone checklist (`docs/release-checklist.md`) passes on one iPhone and one Android phone.
- Bundle stays under the size budget. README and spec are current.

## How to work in this repo

1. **Plan first.** For anything bigger than a small fix, start in plan mode, cite the spec sections the plan relies on, and wait for approval.
2. **Tests first.** Turn the spec rule into a failing test, then implement.
3. **When the spec is silent or contradicts itself, stop and ask.** After Chris decides, record it in `docs/decisions/NNNN-title.md`.
4. **Stay in scope.** `SPEC §11` lists what not to build.
5. **Small commits.** Conventional Commits (`feat(core): …`) citing spec sections (`Refs: SPEC §6`).
6. **Plain language in the UI.** Users are CHWs in the field, not accountants or developers.
7. **Field usability first** (`SPEC §10`).

## Commands

Node 22.12+, pnpm (pinned in `package.json`). All scripts are Node scripts (Windows and macOS).

```
pnpm install                                  install from the lockfile
pnpm exec playwright install chromium webkit  once, for e2e
pnpm dev                                      dev server (no CSP)
pnpm build                                    dist/: index.html, sw.js, manifest.webmanifest, icons/
pnpm preview                                  serve dist/ at http://localhost:4173/chw-timesheet/
pnpm test                                     Vitest unit tests (tests/)
pnpm test:e2e                                 Playwright, WebKit + Chromium, 390×844, axe
pnpm lint | format | format:check | typecheck
pnpm check:dist                               single-file, file allowlist, CSP
pnpm check:size                               150 KB gzip budget (index.html + sw.js + manifest)
pnpm licenses:update                          regenerate THIRD_PARTY_LICENSES.md
pnpm licenses:check                           fail if stale or a runtime license is not allowed
pnpm check                                    everything CI runs except e2e, in order
```

CI (`.github/workflows/ci.yml`) runs `check` steps, then e2e, then deploys `dist/` to Pages on pushes to `main`.
