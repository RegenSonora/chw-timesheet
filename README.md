# Regen Time Tracking

A lightweight, offline phone app for people who work for Regenerating Sonora, Inc.: Community Health Workers and other roles, as contractors or employees. You log time against your role's funding sources, then create an invoice (contractors) or a timesheet (employees) as a PDF, a picture of its first page and two CSV files, to sign and email.

- Live app: https://regensonora.github.io/regen-time-tracking/
- Status: **0.11.0.** Roles, counts per task, employee timesheets and grant periods (decisions 0027–0034, [roles plan](docs/roles-plan.md)). Split from CHW Time Tracker Historic (decision 0020).
- Product spec: [docs/SPEC.md](docs/SPEC.md). Build plans: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md), [docs/roles-plan.md](docs/roles-plan.md). Decisions: [docs/decisions/](docs/decisions/).

## Using the app

### Install (once)

**iPhone**

1. Open https://regensonora.github.io/regen-time-tracking/ in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **Regen Time** from your Home Screen. Always open it from there: Safari and the Home Screen app keep separate data.

**Android**

1. Open https://regensonora.github.io/regen-time-tracking/ in **Chrome**.
2. Tap **Install** when Chrome offers it (or Menu › **Install app**).
3. Open **Regen Time** from your Home Screen or app list.

### Set up (once)

1. Type your name, initials and mailing address, then tap **Next**.
2. **Pick your role**, the one on your agreement (for example CHW-TC01 · CHW Trainee (Contractor)). Ask the office if you're not sure.
3. Check what your role bills: its funding sources, budget lines and tasks, with your hourly rate filled in from your agreement. Tap **This is my role**, or **Pick a different role**.

Your role can't be changed later on the phone. If you picked the wrong one, invoice or submit any hours you've logged, then remove the app and set it up again, or ask the office. After the first time, the app works with **no signal**.

### Every day

- Tap **Start timer** when you begin and **Stop** when you finish. The timer keeps running if you close the app.
- Forgot the timer? Tap **Record time** and type the date, start and end.
- Pick the budget line (when your role has more than one) and check every task you did. With two or more tasks, split your time between them.
- Add counts if you like: the app shows the counts for the tasks you checked. Add notes if you like; notes appear on the timesheet: **don't include client names.** Then **Save**.
- Tap an entry on Home to fix or delete it, until it is invoiced or submitted.
- **My stats** on Home shows the hours you've invoiced (or submitted), with hours still waiting, and your all-time counts. CHW Trainees also see the hrs needed for the pay increase (240) and for CHW Cert eligibility (480). It counts invoices and timesheets made on this phone.
- At 240 hours, CHW Trainees are reminded to invoice or submit, then change their rate to $23.00 in **Settings**.

### Invoices (contractors)

1. On Home, tap **Generate Regen Invoice** (under Past invoices). Check the preview, then tap **Create invoice files**.
2. Tap **Share files** and email the four files to yourself.
3. Sign the PDF, or the picture (PNG) of the invoice page in your photo app. Sign one, not both. Email the signed file with both CSV files to your reviewer.

### Timesheets (employees)

1. On Home, tap **Submit timesheet**. Check the preview, then tap **Create timesheet files**.
2. Tap **Share files** and email the four files to yourself.
3. Sign the PDF, or the picture (PNG) of the timesheet page. Email the signed file with both CSV files to your supervisor, who signs the same page under your signature and sends it to the office.

The full steps, with how to sign on iPhone and Android: [docs/signing-procedure.md](docs/signing-procedure.md). Need the files again? **Past invoices** (or **Past timesheets**) on Home.

### Work Hours Report (CHW Trainees)

For the ADHS **Community Health Worker Hours Worked/Volunteered Attestation Form**. Tap **Eligible** in My stats once you reach 480 hours, or open it any time from **Settings › Work Hours Report**. It lists your invoiced or submitted hours from the past three years for each core competency, in the form's order, with the dates. Tap **Share report** to send yourself a PDF, a picture (PNG) and a CSV, then copy each line onto the form. Your organization's representative fills in and signs the rest of the form.

### Don't lose your hours

Entries are saved **only on your phone**. There is no backup. **Removing the app from your Home Screen (iPhone) or clearing the site's data (Android) erases every entry that isn't invoiced or submitted yet.** Invoice or submit often: once it's emailed, your work is safe.

When the app has a new version, Home shows **Updated, tap to reload**. Tap it when you're ready; it never interrupts an entry. If the office changed your role, Home tells you once after the update.

## Editing roles

_For office staff. Roles live in [`src/roles/roles.json`](src/roles/roles.json); funding sources in [`src/funding-sources/`](src/funding-sources/). Every change is a commit to `main`, which builds, checks and deploys the app; phones get it through "Updated, tap to reload". Bump the file's `version` with each change._

**What a role holds.** A code and name (for example `R-TL01`, "Resilience Team Lead"), `employment` (`contractor` or `employee`), `chw` (true for CHW roles: core competency column and Work Hours Report), and its `funding`: for each source, the rate and NTE (`rate_cents`, `nte_cents`, in cents), an optional raise (`rate_step`) and end date (`ends`), and the budget lines it bills with the tasks under each and the counts each task shows (`count_ids`). An optional `certification_step` (CHW roles only) sets the hours for CHW Cert eligibility. Roles never name a person.

- **Add a role:** add an entry under `roles` with a new `id` (lowercase, hyphens) and `code`. Every budget line and task it lists must already be in the source file; add new ones there first.
- **Change what a role sees:** add or remove budget lines, tasks or `count_ids`. Everyone in the role sees the change after the update. Entries already logged keep their line, task and counts and can still be invoiced; editing one asks for a new pick.
- **Add a count:** add it at the **end** of `counts`, with an `id` in lowercase with underscores (it becomes an entry log column) and a `label`; add a `unit` such as `"gal"` if it has one. Then list it in tasks' `count_ids`.
- **Retire a count:** take it out of every task and mark it `"retired": true`. Never delete or rename a count, and never reuse an id.
- **Retire a role:** mark it `"retired": true`. With `"replaced_by": "<new role id>"`, everyone in it moves to the new role on their next open and sees a one-time notice; rates are not changed, only noted. With no `replaced_by`, its people can still invoice or submit waiting hours but can't log new time ("Your role is no longer active. Ask the office."). Never delete a role.
- **Contractor to employee (or back):** create the new role and retire the old one with `replaced_by`. Hours already logged go out under the old role first.
- **Grant dates:** a source's `period_start` and `period_end`, or an earlier `ends` on a role's funding entry. Time can't be dated outside them; hours inside can still be billed after the end. When all of a role's sources have ended, Home says "No active funding for your role. Ask the office."

**When the build fails**, the message names the role and the field. Common ones:

| Message                                                                                                             | Fix                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `role X: id "…" is already used by role Y` / `code is used by more than one role`                                   | Give each role its own id and code, retired roles included.       |
| `count "…": id is used more than once` / `label "…" matches count "…"`                                              | Each count needs its own id and a label no other count has.       |
| `funding source "…" doesn't exist`                                                                                  | Use a source id from `src/funding-sources/`.                      |
| `budget line "…" isn't in SOURCE` / `task "…" isn't in SOURCE`                                                      | Add the line or task to the source file first, or fix the id.     |
| `count "…" isn't in the count list` / `count "…" is retired`                                                        | Add the count to `counts`, or stop listing a retired one.         |
| `… is listed twice`                                                                                                 | Remove the repeated line, task or count.                          |
| `nte_cents is set but SOURCE has no NTE`                                                                            | Remove `nte_cents` for that source.                               |
| `employee role, but SOURCE has no employee_certification_text …`                                                    | Add `employee_certification_text` to the source file or the role. |
| `certification_step is only for CHW roles (chw: true)`                                                              | Remove it, or set `chw: true`.                                    |
| `replaced_by is set but the role isn't retired` / `replaced_by "…" doesn't exist` / `… is retired` / `forms a loop` | Point `replaced_by` from a retired role to an active one.         |
| `ends … isn't a real date` / `is outside SOURCE's period`                                                           | Use a YYYY-MM-DD date inside the source's period.                 |

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
| `src/roles/`           | Roles and the shared count list                                   |
| `schemas/`             | JSON Schemas                                                      |
| `tests/`               | Unit tests (core, storage, UI helpers)                            |
| `e2e/`                 | Playwright tests                                                  |
| `scripts/`             | Build, check and license scripts (Node)                           |
| `docs/`                | Spec, build plan, decisions, release checklist, signing procedure |

## License

Code: Apache License 2.0 ([LICENSE](LICENSE)). Documentation, task lists and certification text: CC BY 4.0 ([LICENSE-docs](LICENSE-docs)). See [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
