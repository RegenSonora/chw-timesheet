# src/roles

`roles.json` holds the shared count list and the roles people pick at setup (decisions 0027, 0029), validated against `schemas/roles.schema.json` and checked against the funding source files at build time.

- **Counts:** one list for every role. Ids use underscores because they become entry log column names. Add new counts at the end. Never delete or relabel one; mark it `"retired": true` and it keeps its column. `tests/scripts/roles.test.ts` pins every released id and label.
- **Roles:** each lists its funding sources, the budget lines it bills under each, the tasks under each line, and the counts each task shows (`count_ids`, in the shared list's order). Rates, NTE and the raise sit on the funding entry; certification on the role. A role never names a person.
- Ids never change once released. Bump `version` when roles or counts change.

Office instructions: [Editing roles](../../README.md#editing-roles) in the README.
