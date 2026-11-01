# CHW Time Tracker

A lightweight, offline phone app for Community Health Workers at Regenerating Sonora, Inc. CHWs log time against a funding source, then create an invoice PDF and two CSV files to sign and email.

- Live app: https://regensonora.github.io/chw-timesheet/
- Status: **0.9.0, pilot release.** Logging time, invoices, sharing and offline use all work. One or two CHWs run it alongside the spreadsheet before everyone switches (build plan M6).
- Product spec: [docs/SPEC.md](docs/SPEC.md). Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Decisions: [docs/decisions/](docs/decisions/).

## For CHWs

### Install (once)

**iPhone**

1. Open https://regensonora.github.io/chw-timesheet/ in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **CHW Time** from your Home Screen. Always open it from there: Safari and the Home Screen app keep separate data.

**Android**

1. Open https://regensonora.github.io/chw-timesheet/ in **Chrome**.
2. Tap **Install** when Chrome offers it (or Menu › **Install app**).
3. Open **CHW Time** from your Home Screen or app list.

Then fill in setup: your name, initials, mailing address, and the hourly rate from your agreement. After the first time, the app works with **no signal**.

### Every day

- Pick the **funding source** at the top of Home.
- Tap **Start timer** when you begin and **Stop** when you finish. The timer keeps running if you close the app.
- Forgot the timer? Tap **Enter times instead** and type the date, start and end.
- Pick what you did and the budget line, add counts and notes if you like, then **Save**. Notes appear on the timesheet: **don't include client names.**
- Tap an entry on Home to fix or delete it, until it is invoiced.

### Invoicing

1. On Home, tap **Generate … invoice**. Check the preview, then tap **Create invoice files**.
2. Tap **Share files** and email the three files to yourself.
3. Sign the PDF and email it with both CSV files to your reviewer.

The full steps, with how to sign on iPhone and Android: [docs/signing-procedure.md](docs/signing-procedure.md). Need the files again? **Settings › Past invoices**.

### Don't lose your hours

Entries are saved **only on your phone**. There is no backup. **Removing the app from your Home Screen (iPhone) or clearing the site's data (Android) erases every entry that isn't invoiced yet.** Invoice often: once it's emailed, your work is safe.

When the app has a new version, Home shows **Updated, tap to reload**. Tap it when you're ready; it never interrupts an entry.

## For developers

Requires Node 22.12 or later and pnpm (the version is pinned in `package.json`). Works on Windows and macOS; all scripts are Node scripts.

```bash
pnpm install
pnpm exec playwright install chromium webkit
pnpm dev
```

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`             | Dev server with hot reload (no CSP)                                     |
| `pnpm build`           | Builds `dist/`: `index.html`, `sw.js`, `manifest.webmanifest`, `icons/` |
| `pnpm preview`         | Serves `dist/` at http://localhost:4173/chw-timesheet/, like Pages      |
| `pnpm test`            | Unit tests (Vitest, `tests/`)                                           |
| `pnpm test:e2e`        | Browser tests: WebKit and Chromium at 390×844, with axe WCAG 2.1 AA     |
| `pnpm lint`            | ESLint                                                                  |
| `pnpm format`          | Prettier (write); `pnpm format:check` to check only                     |
| `pnpm typecheck`       | TypeScript, strict                                                      |
| `pnpm check:dist`      | Fails unless `dist/` is one self-contained page plus the allowed files  |
| `pnpm check:size`      | Fails over 150 KB gzip (index.html + sw.js + manifest)                  |
| `pnpm licenses:update` | Regenerates `THIRD_PARTY_LICENSES.md`; `pnpm licenses:check` checks it  |
| `pnpm check`           | Everything CI runs except e2e, in order                                 |

### How it is built

The rules that never change are in [CLAUDE.md](CLAUDE.md). In short: Vite and Preact build one self-contained `dist/index.html` with all code and styles inlined, plus a service worker, manifest and icons. A Content-Security-Policy meta tag, generated at build time with hashes of the inlined script and style, blocks every outgoing connection. Data stays on the phone in IndexedDB. All money and time rules live in `src/core/` as plain functions.

Pushes to `main` run CI and, when every check passes, deploy `dist/` to GitHub Pages.

### Offline and updates

`src/sw.ts` caches every file in `dist/` (the list is written in by `scripts/build.mjs`) in a cache named after the release, and answers every page load from it, so the app opens with no signal. Each build stamps its version into `sw.js`, so the phone sees a new release when it next checks. The new worker installs in the background and waits; `src/ui/update.ts` then shows "Updated, tap to reload" on Home, never during an entry or a running timer (decision 0014). Tapping it tells the new worker to take over and reloads. Stored data upgrades run on open (`src/storage/upgrades.ts`).

### Releasing

1. Set `version` in `package.json` (Settings shows it as `0.9.0 (a1b2c3d)`, decision 0016) and merge to `main`. CI deploys to Pages.
2. Run the [release checklist](docs/release-checklist.md) on one iPhone and one Android phone.
3. Icons are generated: `node scripts/make-icons.mjs` rewrites `public/icons/` (decision 0015); commit the output.

### Layout

| Folder                 | Contents                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `src/core/`            | Pure rules (no DOM or storage)                                    |
| `src/storage/`         | IndexedDB and in-memory adapters                                  |
| `src/ui/`              | Preact screens                                                    |
| `src/files/`           | PDF, CSV and QR writers                                           |
| `src/funding-sources/` | One JSON file per funding source                                  |
| `schemas/`             | JSON Schemas                                                      |
| `tests/`               | Unit tests (core, storage, UI helpers)                            |
| `e2e/`                 | Playwright tests                                                  |
| `scripts/`             | Build, check and license scripts (Node)                           |
| `docs/`                | Spec, build plan, decisions, release checklist, signing procedure |

## License

Code: Apache License 2.0 ([LICENSE](LICENSE)). Documentation, task lists and certification text: CC BY 4.0 ([LICENSE-docs](LICENSE-docs)). See [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
