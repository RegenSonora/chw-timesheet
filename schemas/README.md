# schemas

JSON Schemas.

- `funding-source.schema.json`: one funding source file in `src/funding-sources/` (SPEC §3). `pnpm build` and `pnpm check:sources` validate every source file against it, plus unique ids and names (`scripts/lib/funding-sources.mjs`).
