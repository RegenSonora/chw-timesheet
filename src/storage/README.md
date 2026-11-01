# src/storage

Everything the app keeps on the phone, in IndexedDB (CLAUDE.md rules 3, 5, 7). Screens use the `Storage` interface from `index.ts`; tests use the in-memory adapter, which follows the same rules.

- One `Storage` implementation (`storage.ts`) over a small `Backend` with two adapters: IndexedDB (`idb.ts`, hand-written, no library) and memory. The same contract tests run on both.
- **Invoiced means frozen.** `generateInvoice` locks the source's uninvoiced entries, saves the invoice and advances the counter in one transaction. It reads, builds the invoice and fingerprint outside any transaction (WebCrypto would end it early), then re-checks that nothing moved and writes; if something did, it saves nothing and returns `changed`. Locked entries refuse edits and deletes here, not only in the UI. Invoices have no update or delete.
- **Versioned data.** The `meta` store records the data format version (`DATA_VERSION`, now 2: v2 added the app state `draft`), which is also the IndexedDB version. Upgrades are pure steps in `upgrades.ts`, run inside the upgrade transaction: a step that throws leaves the old data and version untouched. Newer data than the app knows is refused, never rewritten.
- Profile, source settings, counter and app state are stored with a UUID and timestamps added here; the `src/core` types stay plain.
- Inside a transaction, await only `Tx` calls: awaiting anything else lets IndexedDB commit early.

| File                | What                                                                        | Spec                  |
| ------------------- | --------------------------------------------------------------------------- | --------------------- |
| `types.ts`          | `Storage`, `AppState`, results, `Tx` and `Backend`                          | §4–§6                 |
| `storage.ts`        | The rules both adapters share: locked entries, counter, singletons, picks   | §4, §5, decision 0005 |
| `generate.ts`       | `generateInvoice` in one transaction                                        | §6, rule 5            |
| `records.ts`        | Data format v1: store names, meta record, wrapping singletons               | rule 7                |
| `upgrades.ts`       | Upgrade steps and runner (none yet: v1 is the first)                        | rule 7                |
| `idb.ts`            | IndexedDB open with upgrades, all-or-nothing transactions                   | rules 3, 5, 7         |
| `idb-storage.ts`    | `openIdbStorage()`: `upgrade_failed`, `newer_data` or `unavailable` on fail | §2                    |
| `memory-storage.ts` | In-memory adapter for tests: copy-on-write, one writer at a time            |                       |
| `persist.ts`        | `requestPersistence()` and `persistenceStatus()` for Settings               | §2                    |

## Adding a data version

1. Bump `DATA_VERSION`, add the new layout to `SCHEMA.layouts` and a step `SCHEMA.steps[old]` that turns the old stores into the new ones.
2. Add a test that opens a database written by every earlier version and checks the result, and one that a failing step leaves it untouched.

Tests live in `tests/storage/`; IndexedDB tests use `fake-indexeddb`.
