# schemas

JSON Schemas.

- `funding-source.schema.json`: one funding source file in `src/funding-sources/` (SPEC §3). `pnpm build` and `pnpm check:sources` validate every source file against it, plus unique ids and names, real dates and a period that doesn't end before it starts (`scripts/lib/funding-sources.mjs`).
- `roles.schema.json`: `src/roles/roles.json`, the shared count list and the roles (decisions 0027, 0029). The same commands validate it, then check it against the source files: every source, budget line, task and count a role names must exist, ids, codes and count labels are unique, and more (`scripts/lib/roles.mjs`, roles plan R1).
