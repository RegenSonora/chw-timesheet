# src/core

Pure rules: money, time, rounding, overlap, page-splitting, invoice, counter and fingerprint logic (CLAUDE.md rule 4).

- Plain functions only. No DOM, storage, UI or file imports; ESLint enforces this.
- Money is integer cents; hours are integer quarter-hours. No floats.
- Filled in by M1.
