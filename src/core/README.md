# src/core

Pure rules: money, time, rounding, overlap, page-splitting, invoice, counter and fingerprint logic (CLAUDE.md rule 4).

- Plain functions only. No DOM, storage, UI or file imports; ESLint enforces this.
- Money is integer cents; hours are integer quarter-hours. No floats.
- Callers pass ids, the current time and time-zone offsets in, so every function is deterministic. The one exception is SHA-256 through WebCrypto (`crypto.subtle`).

| File                             | Rules                                                                                        | Spec                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `types.ts`                       | Profile, funding source, settings, entry, invoice, counter                                   | §3–§7                    |
| `time.ts`                        | ISO timestamps with offset, entry date, quarter-hour rounding, too short, hand-entered times | §5                       |
| `overlap.ts`                     | Overlap on raw times, back-to-back allowed                                                   | §5, decision 0004        |
| `money.ts`                       | Line amounts half up, sums, parsing and formatting dollars and hours                         | §6, §7                   |
| `invoice-number.ts`              | `<INITIALS>-<YYYY>-<NNN>`, shared counter, starting number                                   | §6, decision 0005        |
| `counts.ts`                      | Summing counts, merging custom counts                                                        | §5, §6                   |
| `invoice.ts`                     | Invoice draft (preview) and finished invoice: lines, NTE tracker, counts, snapshot           | §6, decision 0002        |
| `timesheet.ts`                   | Timesheet pages: 7 dates per page, rows, joined notes, totals                                | §7, decisions 0002, 0003 |
| `rate-change.ts`                 | What the rate change dialog must say                                                         | §4                       |
| `summary.ts`                     | Home's not-yet-invoiced count, hours and amount, rounded like the invoice                    | §5, §6                   |
| `picks.ts`                       | Recent tasks first, default budget line, picks kept when an entry changes source             | §5, decision 0008        |
| `canonical.ts`, `fingerprint.ts` | Canonical JSON and SHA-256 fingerprint, versioned (v1)                                       | §7, rule 8               |

Tests live in `tests/core/`. `tests/core/golden/fingerprint-v1.json` pins canonical form v1: never edit it; add a new canonical version instead.
