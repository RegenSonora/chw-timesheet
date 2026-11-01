# CHW Time Tracker

A lightweight, offline phone app for Community Health Workers at Regenerating Sonora, Inc. CHWs log time against a funding source, then create an invoice PDF and two CSV files to sign and email.

- Live app: https://regensonora.github.io/chw-timesheet/
- Status: **in development, not ready for real use.** Setup, the timer, entering and editing time work in the browser; invoice files come next (build plan M4).
- Product spec: [docs/SPEC.md](docs/SPEC.md). Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Decisions: [docs/decisions/](docs/decisions/).

A guide for CHWs (install and daily use) comes with the first release.

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

### Layout

| Folder                 | Contents                                |
| ---------------------- | --------------------------------------- |
| `src/core/`            | Pure rules (no DOM or storage)          |
| `src/storage/`         | IndexedDB and in-memory adapters        |
| `src/ui/`              | Preact screens                          |
| `src/files/`           | PDF, CSV and QR writers                 |
| `src/funding-sources/` | One JSON file per funding source        |
| `schemas/`             | JSON Schemas                            |
| `tests/`               | Unit tests (core, storage, UI helpers)  |
| `e2e/`                 | Playwright tests                        |
| `scripts/`             | Build, check and license scripts (Node) |
| `docs/`                | Spec, build plan, decisions             |

## License

Code: Apache License 2.0 ([LICENSE](LICENSE)). Documentation, task lists and certification text: CC BY 4.0 ([LICENSE-docs](LICENSE-docs)). See [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
