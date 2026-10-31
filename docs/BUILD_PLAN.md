# Build plan — CHW Time Tracker v1

_Written October 31, 2026 from `docs/SPEC.md`._

Each milestone ends with working, tested code merged to `main`. The prompts are written to paste straight into Claude Code. Start each milestone in a **fresh session** (`/clear`) so the context stays focused, and in **plan mode**: review the plan, then let it build.

```
/clear
(plan mode) <paste milestone prompt>
review plan → approve → build
open a pull request, review, merge
```

| # | Milestone | Blocked by | Done when | Est. |
|---|---|---|---|---|
| M0 | Scaffold | GitHub repo created | CI green on an empty app; Pages deploy works | 1 day |
| M1 | Rules core | M0 | Every money, time and invoice rule tested in `src/core/` | 4 days |
| M2 | Storage | M1 | IndexedDB adapter, upgrades and the atomic invoice transaction tested | 1–2 days |
| M3 | Screens: setup and logging | M1, M2 | A CHW can install, set up, time and edit entries in the browser | 4 days |
| M4 | Invoice files | M3 | Preview, PDF, both CSVs, QR, share and re-share work and are tested | 3–4 days |
| M5 | Offline, release and docs | M4 | Offline cache, update flow, e2e + axe, size budget, release checklist, signing procedure | 2 days |
| M6 | Pilot | M5 | One or two CHWs run two real weeks alongside the spreadsheet; totals match | 2 weeks elapsed |

Total build effort: about 15–17 working days for one developer, plus the pilot.

**Before M0:** create the empty public repo `RegenSonora/chw-timesheet` on GitHub with Pages enabled (source: GitHub Actions).

---

## M0 — Scaffold

```
Read CLAUDE.md and docs/SPEC.md §2 and §10. Plan the scaffold. Don't write feature code.
- Single package (no monorepo). Node 22+, pnpm. TypeScript strict; ESLint + Prettier; Vitest; Playwright with
  WebKit and Chromium projects at a 390×844 phone viewport.
- Vite + Preact + vite-plugin-singlefile → dist/index.html with all code and styles inlined, plus dist/sw.js,
  dist/manifest.webmanifest and icons. A build check fails if index.html references any other script or style.
- Folders: src/core (pure rules), src/storage, src/ui, src/files (pdf, csv, qr), src/funding-sources (JSON),
  schemas/, tests/, e2e/, docs/decisions/.
- Content-Security-Policy meta tag: no outgoing connections (connect-src 'none'), no remote scripts or styles.
- GitHub Actions: lint, typecheck, unit tests, build, single-file check, bundle size budget (150 KB compressed),
  license list current; deploy dist/ to GitHub Pages on merge to main.
- LICENSE (Apache-2.0), LICENSE-docs (CC BY 4.0), NOTICE, README, THIRD_PARTY_LICENSES.md generated from dependencies.
- Scripts are Node scripts so they run on Windows and macOS. Fill in the Commands section of CLAUDE.md.
- A placeholder screen that says "CHW Time Tracker" so the Pages deploy can be checked on a phone.
List anything in the spec that affects scaffolding which you think is ambiguous.
```

## M1 — Rules core

```
Read CLAUDE.md and docs/SPEC.md §3–§7 and any docs/decisions/ records. Plan src/core and schemas/. Tests first;
every rule gets tests that try to break it. No DOM or storage imports in src/core.
1. Types: Profile, FundingSourceConfig, SourceSettings (rate cents, NTE cents or null), Entry (UUID, source id,
   raw start/stop ISO with offset, entry date = start date, task, budget line, counts incl. custom label+number,
   notes, invoice id or null, created_at/updated_at), Invoice (UUID, number, source, invoice date, period,
   rate cents, lines, totals, counts this period and all time, NTE snapshot, fingerprint, canonical form version).
2. schemas/funding-source.schema.json + the two source files from SPEC §3 (TISUPP; Regen General Operating with
   Domestic support as both a task with no core competency and a budget line, no NTE). The default rate
   (TISUPP $20.00, SPEC §4) is data in the source file, not code. Build-time validation.
3. Time: rounding raw seconds to the nearest quarter-hour (SPEC §5); an entry that rounds to 0 h is blocked
   (SPEC §5 "Too short"); end before start = next day; entry date = start date; overlap check on raw times
   across all sources, back-to-back allowed (decision 0004).
4. Money: integer cents and quarter-hours; line amount = quarters × rate ÷ 4 rounded half up; total = sum of lines.
   Test odd rates such as $22.37.
5. Invoice builder: all uninvoiced entries for one source; period = first to last entry date; lines by budget line
   in source order (decision 0002); NTE tracker (billed before = earlier invoices for this source; warning only;
   "not entered" state; none for sources without NTE); counts this period and all time for the source.
6. Invoice numbers: <INITIALS>-<YYYY>-<NNN>, one counter shared by all sources, never reset by year or initials;
   starting number set once at setup (decision 0005).
7. Timesheet pages: next 7 unique dates with entries per page; rows = task + budget line pairs on that page; joined
   notes (decision 0003); totals per date, subtotals by budget line, page total.
8. Rate change check: given a new rate and uninvoiced entries for that source, return what the dialog must say.
9. Canonical JSON (sorted keys, no whitespace, integers only) versioned as v1, and SHA-256 fingerprint via
   WebCrypto; short form XXXX-XXXX. A golden-file test pins v1 forever.
Use the wireframe sample data (8 entries, 9.25 h, $185.00, CC-2026-004) as one end-to-end fixture.
```

## M2 — Storage

```
Read CLAUDE.md (rules 3, 5, 7) and src/core types. Plan src/storage. Tests first.
- A Storage interface with an IndexedDB adapter (small hand-written wrapper, no library) and an in-memory adapter.
- Stores: profile, source settings, entries, invoices, counter, app state (running timer start, last budget line,
  last tasks used). Every record set carries a data format version; v1 now, with the upgrade runner in place and
  a test that a fake v0 upgrades.
- generateInvoice() in ONE transaction: lock entries, save invoice, advance counter. Test an interrupted
  transaction leaves nothing half-done.
- Locked entries refuse edits and deletes at the storage layer, not only in the UI.
- navigator.storage.persist() request and a status getter.
- Use fake-indexeddb in tests (dev dependency only).
```

## M3 — Screens: setup and logging

```
Read CLAUDE.md, docs/SPEC.md §2, §4, §5, §9, §10, and look at the wireframes. Plan src/ui with Preact.
Screens: iPhone install gate (block setup unless running standalone; Android not blocked), Setup (details, sources
with per-source rate, storage status, erase warning), Home (source chip, uninvoiced list for the source with
count/hours/amount, Generate button only when entries exist, Start, Enter times), Timer running (large clock,
largest Stop, Discard with confirmation, chip locked, survives reload), Task and budget line (source with
Change, budget line defaulting to last used, recent tasks first), Counts and notes (5 steppers, add another count,
no-names warning), Enter times (overlap and next-day messages), Edit entry, All entries, Settings (details, next
invoice #, per-source rate and NTE, rate change dialog, storage status, version).
Every step saves immediately. Undo after save and delete. Follow SPEC §10 usability rules and WCAG 2.1 AA.
E2E (WebKit + Chromium, phone size): setup → timer → entry → edit → delete/undo; overlap blocked; locked chip.
Stop at the Generate button; invoices are M4.
```

## M4 — Invoice files

```
Read CLAUDE.md, docs/SPEC.md §6–§8, decision 0001 (CSV layouts), and look at the wireframe PDF pages.
Plan src/files and the invoice screens. Tests first.
- Hand-written PDF writer: Letter pages, built-in Helvetica (WinAnsi), text, lines, rectangles, embedded QR image
  or vector squares. Page 1 invoice and landscape timesheet pages exactly as SPEC §7. Text must be selectable.
- Tests open each PDF with a PDF reader library (dev dependency only) and check page count and key text.
- CSV writers producing exactly the two layouts in SPEC §7 (golden-file tests from the wireframe sample data),
  with the formula-injection guard; tests for quoting and the guard.
- QR with a small MIT library; a test decodes it.
- Invoice preview screen (lines, NTE states, counts), Create invoice files (calls storage.generateInvoice, then
  builds files), Invoice created screen with Share (Web Share API with files; download fallback) and next steps,
  and re-share from a past invoice.
- Manual check before merging: the PDF opens and signs in iPhone Markup and Adobe Acrobat Reader Fill & Sign.
```

## M5 — Offline, release and docs

```
Read CLAUDE.md and docs/SPEC.md §2. Plan the release work.
- Service worker: cache the app shell on install; serve offline; new version downloads in the background and shows
  "Updated, tap to reload", never reloading mid-entry. Test offline start in Playwright.
- Manifest and icons (name "CHW Time Tracker", gray tones + accent #1f5fc8, no logo).
- Full e2e: setup → several entries over 9 dates → invoice → files → re-share, in WebKit and Chromium, with axe.
- docs/release-checklist.md: real iPhone and Android steps (install, offline, 8+ days idle on iPhone, share sheet,
  signing in Markup and Acrobat, storage status, update flow).
- docs/signing-procedure.md (CC BY 4.0) per SPEC §8, including the erase warning.
- README for CHWs (install and daily use) and for developers.
```

## M6 — Pilot

Not a coding prompt.

1. Run the release checklist on one iPhone and one Android phone.
2. One or two CHWs log two real weeks in the app **and** the spreadsheet.
3. Compare hours, amounts and counts per invoice. Any difference is a bug or a spec gap: fix it or record a decision.
4. The office receives one signed invoice end to end (CHW → reviewer → office) and confirms it has what it needs.
5. Switch over. Before any future custom subdomain move, follow SPEC §2.
