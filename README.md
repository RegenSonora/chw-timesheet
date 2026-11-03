# Regen Time Tracking

A lightweight, offline phone app for Community Health Workers at Regenerating Sonora, Inc. CHWs log time against a funding source, then create an invoice PDF, a picture of the invoice page and two CSV files to sign and email.

- Live app: https://regensonora.github.io/regen-time-tracking/
- Status: **0.10.0.** Split from CHW Time Tracker Historic (decision 0020); funding sources and features change from here. Logging time, invoices, sharing and offline use all work.
- Product spec: [docs/SPEC.md](docs/SPEC.md). Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Decisions: [docs/decisions/](docs/decisions/).

## For CHWs

### Install (once)

**iPhone**

1. Open https://regensonora.github.io/regen-time-tracking/ in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **Regen Time** from your Home Screen. Always open it from there: Safari and the Home Screen app keep separate data.

**Android**

1. Open https://regensonora.github.io/regen-time-tracking/ in **Chrome**.
2. Tap **Install** when Chrome offers it (or Menu › **Install app**).
3. Open **Regen Time** from your Home Screen or app list.

Then fill in setup: your name, initials, mailing address, and the hourly rate from your agreement. After the first time, the app works with **no signal**.

### Every day

- Pick the **funding source** at the top of Home.
- Tap **Start timer** when you begin and **Stop** when you finish. The timer keeps running if you close the app.
- Forgot the timer? Tap **Record time** and type the date, start and end.
- Pick what you did and the budget line, add counts and notes if you like, then **Save**. Notes appear on the timesheet: **don't include client names.**
- Tap an entry on Home to fix or delete it, until it is invoiced.
- At 240 hours, Home reminds you to generate your invoice and then change your rate to $23.00 in **Settings**.
- **My stats** on Home shows the hours you've invoiced, the hrs needed for your pay increase (240) and the hrs needed for CHW Cert eligibility (480). It counts invoices made on this phone.

### Work Hours Report

For the ADHS **Community Health Worker Hours Worked/Volunteered Attestation Form**. Tap **Eligible** in My stats once you reach 480 hours, or open it any time from **Settings › Work Hours Report**. It lists your invoiced hours from the past three years for each core competency, in the form's order, with the dates. Tap **Share report** to send yourself a PDF, a picture (PNG) and a CSV, then copy each line onto the form. Your organization's representative fills in and signs the rest of the form.

### Invoicing

1. On Home, tap **Generate Regen Invoice** (under Past invoices). Check the preview, then tap **Create invoice files**.
2. Tap **Share files** and email the four files to yourself.
3. Sign the PDF, or the picture (PNG) of the invoice page in your photo app. Sign one, not both. Email the signed file with both CSV files to your reviewer.

The full steps, with how to sign on iPhone and Android: [docs/signing-procedure.md](docs/signing-procedure.md). Need the files again? **Past invoices** on Home.

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

| Command                | What it does                                                             |
| ---------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`             | Dev server with hot reload (no CSP)                                      |
| `pnpm build`           | Builds `dist/`: `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`  |
| `pnpm preview`         | Serves `dist/` at http://localhost:4173/regen-time-tracking/, like Pages |
| `pnpm test`            | Unit tests (Vitest, `tests/`)                                            |
| `pnpm test:e2e`        | Browser tests: WebKit and Chromium at 390×844, with axe WCAG 2.1 AA      |
| `pnpm lint`            | ESLint                                                                   |
| `pnpm format`          | Prettier (write); `pnpm format:check` to check only                      |
| `pnpm typecheck`       | TypeScript, strict                                                       |
| `pnpm check:dist`      | Fails unless `dist/` is one self-contained page plus the allowed files   |
| `pnpm check:size`      | Fails over 150 KB gzip (index.html + sw.js + manifest)                   |
| `pnpm licenses:update` | Regenerates `THIRD_PARTY_LICENSES.md`; `pnpm licenses:check` checks it   |
| `pnpm check`           | Everything CI runs except e2e, in order                                  |

### How it is built

The rules that never change are in [CLAUDE.md](CLAUDE.md). In short: Vite and Preact build one self-contained `dist/index.html` with all code and styles inlined, plus a service worker, manifest and icons. A Content-Security-Policy meta tag, generated at build time with hashes of the inlined script and style, blocks every outgoing connection. Data stays on the phone in IndexedDB. All money and time rules live in `src/core/` as plain functions.

Pushes to `main` run CI and, when every check passes, deploy `dist/` to GitHub Pages.

### Offline and updates

`src/sw.ts` caches every file in `dist/` (the list is written in by `scripts/build.mjs`) in a cache named after the release, and answers every page load from it, so the app opens with no signal. Each build stamps its version into `sw.js`, so the phone sees a new release when it next checks. The new worker installs in the background and waits; `src/ui/update.ts` then shows "Updated, tap to reload" on Home, never during an entry or a running timer (decision 0014). Tapping it tells the new worker to take over and reloads. Stored data upgrades run on open (`src/storage/upgrades.ts`).

### Releasing

1. Set `version` in `package.json` (Settings shows it as `0.9.0 (a1b2c3d)`, decision 0016) and merge to `main`. CI deploys to Pages.
2. Run the [release checklist](docs/release-checklist.md) on one iPhone and one Android phone.
3. Icons are generated: `node scripts/make-icons.mjs` rewrites `public/icons/` (decision 0021); commit the output.

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
